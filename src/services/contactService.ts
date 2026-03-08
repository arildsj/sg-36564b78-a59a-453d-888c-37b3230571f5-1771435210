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
    const base64Content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await db
      .from("user_profiles")
      .select("tenant_id")
      .eq("id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

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