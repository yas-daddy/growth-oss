import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface AgeBreakdown {
  age: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  cpm: number;
  results: number;
  costPerResult: number | null;
}

export interface GenderBreakdown {
  gender: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  cpm: number;
  results: number;
  costPerResult: number | null;
}

export interface AgeGenderBreakdown {
  age: string;
  gender: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  cpm: number;
  results: number;
  costPerResult: number | null;
}

export interface Campaign {
  id: string;
  name: string;
  status: string;
}

export interface DemographicsData {
  ageBreakdown: AgeBreakdown[];
  genderBreakdown: GenderBreakdown[];
  ageGenderBreakdown: AgeGenderBreakdown[];
  totalSpend: number;
  topGender: GenderBreakdown | null;
  topAge: AgeBreakdown | null;
  topAgeGender: AgeGenderBreakdown | null;
  campaigns: Campaign[];
  dateRange: { start: string; end: string };
}

export function useMetaDemographics(startDate?: string, endDate?: string, campaignId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['meta-demographics', startDate, endDate, campaignId],
    queryFn: async (): Promise<DemographicsData> => {
      const { data, error } = await supabase.functions.invoke('meta-fetch-demographics', {
        body: { startDate, endDate, campaignId },
      });

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!startDate && !!endDate,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
