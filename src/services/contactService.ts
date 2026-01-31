import { supabase } from "@/integrations/supabase/client";

export type Contact = {
  id: string;
  phone: string;
  name: string; // Mapped from description
  email: string | null; // Not supported in current schema, returning null
  is_whitelisted: boolean; // Always true for this table
  groups: Array<{ id: string; name: string }>;
};

export const contactService = {
  async getAllContacts() {
    // 1. Get all whitelisted numbers
    const { data: contacts, error } = await supabase
      .from("whitelisted_numbers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // 2. Get all group links for these contacts
    const { data: links, error: linksError } = await supabase
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
    return (contacts || []).map((contact) => {
      const contactLinks = links?.filter(
        (l) => l.whitelisted_number_id === contact.id
      ) || [];
      
      const groups = contactLinks
        .map((l) => l.group)
        .filter((g): g is { id: string; name: string } => !!g);

      return {
        id: contact.id,
        phone: contact.phone_number,
        name: contact.description || "Ukjent navn",
        email: null,
        is_whitelisted: true,
        groups
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

    const { data: profile } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("auth_user_id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    // 2. Create whitelisted number
    const { data: newContact, error } = await supabase
      .from("whitelisted_numbers")
      .insert({
        phone_number: contact.phone,
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

      const { error: linkError } = await supabase
        .from("whitelist_group_links")
        .insert(links);

      if (linkError) throw linkError;
    }

    return newContact;
  },
  
  async searchContacts(query: string) {
    const { data, error } = await supabase
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
      .or(`phone_number.ilike.%${query}%,description.ilike.%${query}%`)
      .limit(20);
      
    if (error) throw error;
    
    return (data || []).map((c: any) => ({
      id: c.id,
      phone: c.phone_number,
      name: c.description || "Ukjent navn",
      email: null,
      is_whitelisted: true,
      groups: c.whitelist_group_links?.map((l: any) => l.group).filter(Boolean) || []
    }));
  },

  async updateContact(id: string, contact: {
    name: string;
    phone: string;
    email: string | null;
    is_whitelisted: boolean;
    group_ids: string[];
  }) {
    // 1. Update basic info
    const { error: updateError } = await supabase
      .from("whitelisted_numbers")
      .update({
        phone_number: contact.phone,
        description: contact.name,
      })
      .eq("id", id);

    if (updateError) throw updateError;

    // 2. Sync groups (Simple strategy: Delete all, then re-insert)
    // First delete existing links
    const { error: deleteLinksError } = await supabase
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

      const { error: insertLinksError } = await supabase
        .from("whitelist_group_links")
        .insert(links);

      if (insertLinksError) throw insertLinksError;
    }
  },

  async deleteContact(id: string) {
    const { error } = await supabase
      .from("whitelisted_numbers")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async getContactsByGroup(groupId: string): Promise<Contact[]> {
    const { data, error } = await supabase
      .from("whitelist_group_links")
      .select(`
        whitelisted_number:whitelisted_numbers (*)
      `)
      .eq("group_id", groupId);

    if (error) throw error;

    // Transform to Contact type
    return (data || [])
      .map((link: any) => link.whitelisted_number)
      .filter((contact): contact is any => !!contact)
      .map((contact) => ({
        id: contact.id,
        phone: contact.phone_number,
        name: contact.description || "Ukjent navn",
        email: null,
        is_whitelisted: true,
        groups: [] // We don't need the full group list here for this view
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

    const { data: profile } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("auth_user_id", user.user.id)
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
    const { data: asRelated, error: error1 } = await supabase
      .from("contact_relationships")
      .select(`
        id,
        relationship_type,
        subject:contacts!subject_contact_id(id, name, group_id)
      `)
      .eq("related_contact_id", contactId);

    if (error1) throw error1;

    // Get relationships where this contact is the 'subject' (e.g. they are the student)
    const { data: asSubject, error: error2 } = await supabase
      .from("contact_relationships")
      .select(`
        id,
        relationship_type,
        related:contacts!related_contact_id(id, name, phone_number)
      `)
      .eq("subject_contact_id", contactId);

    if (error2) throw error2;

    return {
      asRelated: asRelated || [],
      asSubject: asSubject || []
    };
  },

  async addRelationship(subjectId: string, relatedId: string, type: string) {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) throw new Error("Not authenticated");

    const { data: profile } = await supabase
      .from("users")
      .select("tenant_id")
      .eq("auth_user_id", user.user.id)
      .single();

    if (!profile) throw new Error("User profile not found");

    const { error } = await supabase
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
    const { error } = await supabase
      .from("contact_relationships")
      .delete()
      .eq("id", relationshipId);

    if (error) throw error;
  }
};