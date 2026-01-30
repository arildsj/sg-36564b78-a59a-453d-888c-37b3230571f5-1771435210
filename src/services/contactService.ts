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
  }
};