import { supabase } from "@/integrations/supabase/client";
import { auditService } from "./auditService";

const db = supabase as any;

// FASIT: Simplified contact structure
export type Contact = {
  id: string;
  phone: string;  // FASIT: 'phone' (not phone)
  name: string;   // FASIT: 'name' (not first_name/last_name)
  group_id: string | null;  // FASIT: Direct group_id
  tags: string[];
  tenant_id: string;
  created_at: string;
  updated_at: string;
};

export type ContactGroup = {
  id: string;
  tenant_id: string;
  group_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export const contactService = {
  async getAllContacts(): Promise<Contact[]> {
    const { data, error } = await db
      .from("contacts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data || []) as Contact[];
  },

  async createContact(contact: {
    name: string;
    phone: string;
    group_id: string | null;
    tags?: string[];
  }) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    const { data: newContact, error } = await db
      .from("contacts")
      .insert({
        phone: contact.phone,  // FASIT: 'phone'
        name: contact.name,    // FASIT: 'name'
        group_id: contact.group_id,  // FASIT: Direct group_id
        tags: contact.tags || [],
        tenant_id: profile.tenant_id
      })
      .select()
      .single();

    if (error) throw error;

    return newContact;
  },
  
  async searchContacts(query: string): Promise<Contact[]> {
    const { data, error } = await db
      .from("contacts")
      .select("*")
      .or(`phone.ilike.%${query}%,name.ilike.%${query}%`)
      .limit(20);
      
    if (error) throw error;
    
    return (data || []) as Contact[];
  },

  async getContactsByUserAccess(): Promise<Contact[]> {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("user_profiles")
      .select("tenant_id, role, group_memberships(group_id)")
      .eq("id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    // Tenant-admin sees all contacts in their tenant
    if (profile.role === "tenant_admin") {
      const { data, error } = await db
        .from("contacts")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as Contact[];
    }

    // Regular users see only contacts in groups they belong to
    const userGroupIds = (profile.group_memberships || []).map((m: any) => m.group_id);
    
    if (userGroupIds.length === 0) {
      return [];
    }

    const { data, error } = await db
      .from("contacts")
      .select("*")
      .in("group_id", userGroupIds)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data || []) as Contact[];
  },

  async updateContact(id: string, contact: {
    name: string;
    phone: string;
    group_id: string | null;
    tags?: string[];
  }) {
    const { error } = await db
      .from("contacts")
      .update({
        phone: contact.phone,  // FASIT: 'phone'
        name: contact.name,    // FASIT: 'name'
        group_id: contact.group_id,  // FASIT: Direct group_id
        tags: contact.tags || []
      })
      .eq("id", id);

    if (error) throw error;
  },

  async deleteContact(id: string) {
    const { error } = await db
      .from("contacts")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async getContactsByGroup(groupId: string): Promise<Contact[]> {
    const { data, error } = await db
      .from("contacts")
      .select("*")
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data || []) as Contact[];
  },

  async importContacts(file: File, groupId?: string) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    const content = await file.text();
    const rows = this.parseCSV(content);
    if (rows.length === 0) {
      throw new Error("CSV-filen inneholder ingen gyldige rader");
    }

    let imported = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const phone = (row.phone || row.telefon || row.tlf || "").trim();
        const name = (row.name || row.navn || "").trim();

        if (!phone) {
          failed++;
          continue;
        }

        const { data: existing } = await db
          .from("contacts")
          .select("id")
          .eq("tenant_id", profile.tenant_id)
          .eq("phone", phone)
          .maybeSingle();

        let contactId = existing?.id as string | undefined;

        if (contactId) {
          await db
            .from("contacts")
            .update({
              name: name || phone,
              group_id: groupId || null,
            })
            .eq("id", contactId);
        } else {
          const { data: created, error: createError } = await db
            .from("contacts")
            .insert({
              tenant_id: profile.tenant_id,
              phone,
              name: name || phone,
              group_id: groupId || null,
              tags: [],
            })
            .select("id")
            .single();

          if (createError) throw createError;
          contactId = created.id;
        }

        imported++;
      } catch (error) {
        console.error("Contact import row failed:", error);
        failed++;
      }
    }

    return { imported, failed };
  },

  async importContactsToGroup(file: File, params: { groupId: string; contactGroupId?: string }) {
    const result = await this.importContacts(file, params.groupId);
    if (!params.contactGroupId) return result;

    const content = await file.text();
    const rows = this.parseCSV(content);
    const phones = rows
      .map((row) => (row.phone || row.telefon || row.tlf || "").trim())
      .filter(Boolean);

    if (phones.length === 0) return result;

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    const { data: importedContacts } = await db
      .from("contacts")
      .select("id, phone")
      .eq("tenant_id", profile.tenant_id)
      .in("phone", phones);

    for (const contact of importedContacts || []) {
      const { data: existing } = await db
        .from("contact_group_members")
        .select("contact_id")
        .eq("contact_group_id", params.contactGroupId)
        .eq("contact_id", contact.id)
        .maybeSingle();

      if (!existing) {
        await db.from("contact_group_members").insert({
          contact_group_id: params.contactGroupId,
          contact_id: contact.id,
        });
      }
    }

    return result;
  },

  async getContactGroups(groupId?: string): Promise<ContactGroup[]> {
    let query = db
      .from("contact_groups")
      .select("*")
      .order("name", { ascending: true });

    if (groupId) {
      query = query.eq("group_id", groupId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as ContactGroup[];
  },

  async createContactGroup(params: { group_id: string; name: string; description?: string }) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    const { data, error } = await db
      .from("contact_groups")
      .insert({
        tenant_id: profile.tenant_id,
        group_id: params.group_id,
        name: params.name,
        description: params.description || null,
      })
      .select("*")
      .single();

    if (error) throw error;
    return data as ContactGroup;
  },

  async updateContactGroup(id: string, params: { name: string; description?: string }) {
    const { data, error } = await db
      .from("contact_groups")
      .update({
        name: params.name,
        description: params.description || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) throw error;
    return data as ContactGroup;
  },

  async getContactGroupMemberships(): Promise<Record<string, ContactGroup[]>> {
    const { data, error } = await db
      .from("contact_group_members")
      .select(`
        contact_id,
        contact_groups:contact_group_id (
          id,
          tenant_id,
          group_id,
          name,
          description,
          created_at,
          updated_at
        )
      `);

    if (error) throw error;

    const map: Record<string, ContactGroup[]> = {};
    for (const row of data || []) {
      if (!map[row.contact_id]) {
        map[row.contact_id] = [];
      }
      if (row.contact_groups) {
        map[row.contact_id].push(row.contact_groups as ContactGroup);
      }
    }
    return map;
  },

  async setContactGroupMemberships(contactId: string, contactGroupIds: string[]) {
    await db.from("contact_group_members").delete().eq("contact_id", contactId);

    if (contactGroupIds.length === 0) return;

    const inserts = contactGroupIds.map((id) => ({
      contact_id: contactId,
      contact_group_id: id,
    }));

    const { error } = await db.from("contact_group_members").insert(inserts);
    if (error) throw error;
  },

  parseCSV(text: string): Array<Record<string, string>> {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) return [];

    const separator = lines[0].includes(";") ? ";" : ",";
    const headers = lines[0].split(separator).map((header) => header.trim().toLowerCase());

    return lines.slice(1).map((line) => {
      const values = line.split(separator).map((value) => value.trim());
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      return row;
    });
  },

  /**
   * GDPR: Get all data for a contact
   */
  async getContactData(contactId: string) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("user_profiles")
      .select("tenant_id, role")
      .eq("id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");
    
    if (profile.role !== "tenant_admin") {
      throw new Error("Unauthorized: Only tenant administrators can access contact data");
    }

    const { data: contact, error } = await db
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .single();

    if (error) throw error;

    await auditService.logAction({
      action: "gdpr_contact_access",
      entity_type: "contact",
      entity_id: contactId,
      details: {
        contact_phone: contact.phone,
        contact_name: contact.name,
        accessed_by: user.user.id,
        reason: "GDPR data access request"
      }
    });

    return contact;
  },

  /**
   * GDPR: Delete contact and log the action
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
    
    if (profile.role !== "tenant_admin") {
      throw new Error("Unauthorized: Only tenant administrators can perform GDPR deletions");
    }

    const { data: contact } = await db
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .single();

    if (!contact) throw new Error("Contact not found");

    const { error: deleteError } = await db
      .from("contacts")
      .delete()
      .eq("id", contactId);

    if (deleteError) throw deleteError;

    await auditService.logAction({
      action: "gdpr_contact_deletion",
      entity_type: "contact",
      entity_id: contactId,
      details: {
        contact_phone: contact.phone,
        contact_name: contact.name,
        deleted_by: user.user.id,
        reason: reason,
        timestamp: new Date().toISOString()
      }
    });

    return {
      success: true,
      contact: {
        phone: contact.phone,
        name: contact.name
      }
    };
  }
};
