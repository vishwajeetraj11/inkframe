export type LicensedAudioProvider = "jamendo" | "freesound";

export interface LicensedAudioResult {
  id: string;
  provider: LicensedAudioProvider;
  title: string;
  creatorName: string;
  creatorUrl: string;
  sourceUrl: string;
  audioUrl: string;
  durationSeconds: number;
  licenseName: string;
  licenseUrl: string;
  attributionRequired: boolean;
  tags: string[];
}

export interface LicensedAudioSearchResult {
  provider: LicensedAudioProvider;
  query: string;
  results: LicensedAudioResult[];
}
