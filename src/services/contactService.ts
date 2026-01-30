import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type WhitelistedNumber = Database["public"]["Tables"]["whitelisted_numbers"]["Row"];
type WhitelistGroupLink = Database["public"]["Tables"]["whitelist_group_links"]["Row"];

export const contactService = {
  async getAllContacts(): Promise<WhitelistedNumber[]> {
    const { data, error } = await supabase
      .from("whitelisted_numbers")
      .select("*")
      .order("phone_number");

    if (error) throw error;
    return data || [];
  },

  async getContactById(id: string): Promise<WhitelistedNumber | null> {
    const { data, error } = await supabase
      .from("whitelisted_numbers")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  async getContactGroups(contactId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from("whitelist_group_links")
      .select("group_id")
      .eq("whitelisted_number_id", contactId);

    if (error) throw error;
    return (data || []).map((link) => link.group_id);
  },

  async createContact(
    phoneNumber: string,
    description?: string
  ): Promise<WhitelistedNumber> {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .single();

    if (!tenant) throw new Error("No tenant found");

    const { data, error } = await supabase
      .from("whitelisted_numbers")
      .insert({
        tenant_id: tenant.id,
        phone_number: phoneNumber,
        description,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async linkContactToGroup(contactId: string, groupId: string): Promise<void> {
    const { error } = await supabase
      .from("whitelist_group_links")
      .insert({
        whitelisted_number_id: contactId,
        group_id: groupId,
      });

    if (error) throw error;
  },

  async unlinkContactFromGroup(contactId: string, groupId: string): Promise<void> {
    const { error } = await supabase
      .from("whitelist_group_links")
      .delete()
      .eq("whitelisted_number_id", contactId)
      .eq("group_id", groupId);

    if (error) throw error;
  },
};