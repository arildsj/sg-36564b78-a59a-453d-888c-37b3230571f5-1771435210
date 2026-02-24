import { supabase } from "@/integrations/supabase/client";
import { auditService } from "./auditService";

// CRITICAL FIX: Cast supabase to any to completely bypass "Type instantiation is excessively deep" errors
const db = supabase as any;

export type Contact = {
  id: string;
  phone: string;
  name: string; // Mapped from description
  email: string | null; // Not supported in current schema, returning null
  is_whitelisted: boolean; // Always true for this table
  groups: Array<{ id: string; name: string }>;
  created_at: string;
};

export const contactService = {
  async getAllContacts() {
    // 1. Get all whitelisted numbers
    const { data: contacts, error } = await db
      .from("whitelisted_numbers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // 2. Get all group links for these contacts
    const { data: links, error: linksError } = await db
      .from("whitelist_group_links")
      .select(`
        whitelisted_number_id,
        group:groups (
          id,
          name
        )
      `);

    if (linksError) throw linksError;

    // 3. Map contacts and attach groups
    return (contacts || []).map((contact: any) => {
      const contactLinks = links?.filter(
        (l: any) => l.whitelisted_number_id === contact.id
      ) || [];
      
      const groups = contactLinks
        .map((l: any) => l.group)
        .filter((g: any): g is { id: string; name: string } => !!g);

      return {
        id: contact.id,
        phone: contact.identifier,
        name: contact.description || "Ukjent navn",
        email: null,
        is_whitelisted: true,
        groups,
        created_at: contact.created_at
      };
    });
  },

  async createContact(contact: {
    name: string;
    phone: string;
    email: string | null;
    is_whitelisted: boolean;
    group_ids: string[];
  }) {
    // 1. Get tenant_id
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    // 2. Create whitelisted number
    const { data: newContact, error } = await db
      .from("whitelisted_numbers")
      .insert({
        identifier: contact.phone,
        description: contact.name,
        tenant_id: profile.tenant_id
      })
      .select()
      .single();

    if (error) throw error;

    // 3. Add to groups
    if (contact.group_ids.length > 0) {
      const links = contact.group_ids.map((groupId) => ({
        whitelisted_number_id: newContact.id,
        group_id: groupId
      }));

      const { error: linkError } = await db
        .from("whitelist_group_links")
        .insert(links);

      if (linkError) throw linkError;
    }

    return newContact;
  },
  
  async searchContacts(query: string) {
    const { data, error } = await db
      .from("whitelisted_numbers")
      .select(`
        *,
        whitelist_group_links (
          group:groups (
            id,
            name
          )
        )
      `)
      .or(`identifier.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(20);
      
    if (error) throw error;
    
    return (data || []).map((c: any) => ({
      id: c.id,
      phone: c.identifier,
      name: c.description || "Ukjent navn",
      email: null,
      is_whitelisted: true,
      groups: c.whitelist_group_links?.map((l: any) => l.group).filter(Boolean) || [],
      created_at: c.created_at
    }));
  },

  async getContactsByUserAccess() {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("user_profiles")
      .select("tenant_id, role, group_memberships(group_id)")
      .eq("id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    // Tenant-admin sees all contacts
    if (profile.role === "tenant_admin") {
      return this.getAllContacts();
    }

    // Regular users see only contacts in groups they belong to
    const userGroupIds = (profile.group_memberships || []).map((m: any) => m.group_id);
    
    if (userGroupIds.length === 0) {
      return []; // No group access = no contacts
    }

    const { data, error } = await db
      .from("whitelist_group_links")
      .select(`
        whitelisted_number:whitelisted_numbers (
          id,
          identifier,
          description,
          created_at
        )
      `)
      .in("group_id", userGroupIds);

    if (error) throw error;

    // Deduplicate contacts (a contact can be in multiple groups)
    const contactMap = new Map();
    (data || []).forEach((link: any) => {
      const contact = link.whitelisted_number;
      if (contact && !contactMap.has(contact.id)) {
        contactMap.set(contact.id, {
          id: contact.id,
          phone: contact.identifier,
          name: contact.description || "Ukjent navn",
          email: null,
          is_whitelisted: true,
          groups: [],
          created_at: contact.created_at
        });
      }
    });

    return Array.from(contactMap.values());
  },

  async updateContact(id: string, contact: {
    name: string;
    phone: string;
    email: string | null;
    is_whitelisted: boolean;
    group_ids: string[];
  }) {
    // 1. Update basic info
    const { error: updateError } = await db
      .from("whitelisted_numbers")
      .update({
        identifier: contact.phone,
        description: contact.name,
      })
      .eq("id", id);

    if (updateError) throw updateError;

    // 2. Sync groups (Simple strategy: Delete all, then re-insert)
    // First delete existing links
    const { error: deleteLinksError } = await db
      .from("whitelist_group_links")
      .delete()
      .eq("whitelisted_number_id", id);

    if (deleteLinksError) throw deleteLinksError;

    // Then insert new links
    if (contact.group_ids.length > 0) {
      const links = contact.group_ids.map((groupId) => ({
        whitelisted_number_id: id,
        group_id: groupId
      }));

      const { error: insertLinksError } = await db
        .from("whitelist_group_links")
        .insert(links);

      if (insertLinksError) throw insertLinksError;
    }
  },

  async deleteContact(id: string) {
    const { error } = await db
      .from("whitelisted_numbers")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async getContactsByGroup(groupId: string): Promise<Contact[]> {
    const { data, error } = await db
      .from("whitelist_group_links")
      .select(`
        whitelisted_number:whitelisted_numbers (*)
      `)
      .eq("group_id", groupId);

    if (error) throw error;

    // Transform to Contact type
    return (data || [])
      .map((link: any) => link.whitelisted_number)
      .filter((contact: any) => !!contact)
      .map((contact: any) => ({
        id: contact.id,
        phone: contact.identifier,
        name: contact.description || "Ukjent navn",
        email: null,
        is_whitelisted: true,
        groups: [], // We don't need the full group list here for this view
        created_at: contact.created_at
      }));
  },

  async importContacts(file: File, groupId?: string) {
    // 1. Convert file to Base64
    const base64Content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:text/csv;base64,")
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    // 2. Get tenant and user
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    // 3. Call Edge Function
    const { data, error } = await supabase.functions.invoke("csv-import", {
      body: {
        tenant_id: profile.tenant_id,
        created_by_user_id: user.user.id,
        import_type: "contacts",
        csv_data: base64Content,
        group_id: groupId
      }
    });

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    return data;
  },

  async getRelationships(contactId: string) {
    // Get relationships where this contact is the 'related_contact' (e.g. they are the parent)
    const { data: asRelated, error: error1 } = await db
      .from("contact_relationships")
      .select(`
        id,
        relationship_type,
        subject:contacts!subject_contact_id(id, name, group_id)
      `)
      .eq("related_contact_id", contactId);

    if (error1) {
       // Fallback for missing relationship column names if schema changed
       console.warn("Error fetching relationships (asRelated), returning empty", error1);
       return { asRelated: [], asSubject: [] };
    }

    // Get relationships where this contact is the 'subject' (e.g. they are the student)
    const { data: asSubject, error: error2 } = await db
      .from("contact_relationships")
      .select(`
        id,
        relationship_type,
        related:contacts!related_contact_id(id, name, identifier)
      `)
      .eq("subject_contact_id", contactId);

    if (error2) {
       console.warn("Error fetching relationships (asSubject), returning empty", error2);
       return { asRelated: [], asSubject: [] };
    }

    return {
      asRelated: asRelated || [],
      asSubject: asSubject || []
    };
  },

  async addRelationship(subjectId: string, relatedId: string, type: string) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    const { error } = await db
      .from("contact_relationships")
      .insert({
        tenant_id: profile.tenant_id,
        subject_contact_id: subjectId,
        related_contact_id: relatedId,
        relationship_type: type
      });

    if (error) throw error;
  },

  async removeRelationship(relationshipId: string) {
    const { error } = await db
      .from("contact_relationships")
      .delete()
      .eq("id", relationshipId);

    if (error) throw error;
  },

  /**
   * GDPR: Get all groups a contact is member of
   * Logs the access for audit trail
   */
  async getContactGroupMemberships(contactId: string) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("user_profiles")
      .select("tenant_id, role")
      .eq("id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");
    
    // Only tenant_admin can access this
    if (profile.role !== "tenant_admin") {
      throw new Error("Unauthorized: Only tenant administrators can access contact group memberships");
    }

    // Get contact details
    const { data: contact } = await db
      .from("whitelisted_numbers")
      .select("*")
      .eq("id", contactId)
      .single();

    if (!contact) throw new Error("Contact not found");

    // Get all group memberships
    const { data: memberships, error } = await db
      .from("whitelist_group_links")
      .select(`
        group:groups (
          id,
          name,
          kind
        )
      `)
      .eq("whitelisted_number_id", contactId);

    if (error) throw error;

    // Log GDPR access
    await auditService.logAction({
      action: "gdpr_contact_access",
      entity_type: "whitelisted_number",
      entity_id: contactId,
      details: {
        contact_phone: contact.identifier,
        contact_name: contact.description,
        accessed_by: user.user.id,
        reason: "GDPR data access request"
      }
    });

    return {
      contact: {
        id: contact.id,
        phone: contact.identifier,
        name: contact.description,
      },
      groups: memberships?.map((m: any) => m.group).filter(Boolean) || []
    };
  },

  /**
   * GDPR: Delete contact from all groups and log the action
   * Only accessible by tenant-admin
   */
  async deleteContactGDPR(contactId: string, reason: string) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("user_profiles")
      .select("tenant_id, role")
      .eq("id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");
    
    // Only tenant-admin can delete
    if (profile.role !== "tenant_admin") {
      throw new Error("Unauthorized: Only tenant administrators can perform GDPR deletions");
    }

    // Get contact details before deletion for audit log
    const { data: contact } = await db
      .from("whitelisted_numbers")
      .select("*")
      .eq("id", contactId)
      .single();

    if (!contact) throw new Error("Contact not found");

    // Get all group memberships before deletion
    const { data: memberships } = await db
      .from("whitelist_group_links")
      .select(`
        group:groups (id, name)
      `)
      .eq("whitelisted_number_id", contactId);

    const groupNames = memberships?.map((m: any) => m.group?.name).filter(Boolean) || [];

    // Delete the contact (cascades will remove group links)
    const { error: deleteError } = await db
      .from("whitelisted_numbers")
      .delete()
      .eq("id", contactId);

    if (deleteError) throw deleteError;

    // Log GDPR deletion
    await auditService.logAction({
      action: "gdpr_contact_deletion",
      entity_type: "whitelisted_number",
      entity_id: contactId,
      details: {
        contact_phone: contact.identifier,
        contact_name: contact.description,
        deleted_by: user.user.id,
        reason: reason,
        groups_removed_from: groupNames,
        timestamp: new Date().toISOString()
      }
    });

    return {
      success: true,
      contact: {
        phone: contact.identifier,
        name: contact.description
      },
      groups_removed: groupNames.length
    };
  }
};