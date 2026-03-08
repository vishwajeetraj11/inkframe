import type {
  Feature,
  FeatureCollection,
  Geometry,
  GeoJsonProperties,
  MultiLineString,
} from "geojson";
import countries110m from "world-atlas/countries-110m.json";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";

type CountryProperties = GeoJsonProperties & {
  name?: string;
};

type WorldTopology = {
  objects: {
    countries: unknown;
    land: unknown;
  };
};

export type WorldCountryFeature = Feature<Geometry, CountryProperties> & {
  id?: string | number;
};

export interface ProjectedWorldCountry {
  id: string;
  name: string;
  path: string;
  centroid: [number, number];
}

export interface ProjectedWorldMap {
  width: number;
  height: number;
  landPath: string;
  bordersPath: string;
  countries: ProjectedWorldCountry[];
}

const worldTopology = countries110m as unknown as WorldTopology;
const topologyInput = worldTopology as unknown as Parameters<typeof feature>[0];
const countriesObject =
  worldTopology.objects.countries as Parameters<typeof feature>[1];
const landObject = worldTopology.objects.land as Parameters<typeof feature>[1];
const meshCountriesObject =
  worldTopology.objects.countries as Parameters<typeof mesh>[1];

const countryCollection = feature(
  topologyInput,
  countriesObject,
) as unknown as FeatureCollection<Geometry, CountryProperties>;

const landFeature = feature(
  topologyInput,
  landObject,
) as unknown as Feature<Geometry>;

const borderMesh = mesh(
  topologyInput,
  meshCountriesObject,
  (a, b) => a !== b,
) as MultiLineString;

const normalizeCountryName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const WORLD_COUNTRY_FEATURES: WorldCountryFeature[] =
  countryCollection.features.map((country) => ({
    ...country,
    properties: {
      ...country.properties,
      name: country.properties?.name ?? "",
    },
  }));

export const WORLD_COUNTRY_NAMES = WORLD_COUNTRY_FEATURES.map(
  (country) => country.properties?.name ?? "",
).filter((name) => name.length > 0);

export const normalizeWorldCountryName = (value: string): string =>
  normalizeCountryName(value);

export const findWorldCountry = (
  name: string,
): WorldCountryFeature | null => {
  const normalizedTarget = normalizeCountryName(name);
  if (!normalizedTarget) {
    return null;
  }

  const exactMatch = WORLD_COUNTRY_FEATURES.find(
    (country) =>
      normalizeCountryName(country.properties?.name ?? "") === normalizedTarget,
  );
  if (exactMatch) {
    return exactMatch;
  }

  const partialMatch = WORLD_COUNTRY_FEATURES.find((country) =>
    normalizeCountryName(country.properties?.name ?? "").includes(
      normalizedTarget,
    ),
  );

  return partialMatch ?? null;
};

export const findProjectedWorldCountry = (
  projectedMap: ProjectedWorldMap,
  name: string,
): ProjectedWorldCountry | null => {
  const normalizedTarget = normalizeCountryName(name);
  if (!normalizedTarget) {
    return null;
  }

  const exactMatch = projectedMap.countries.find(
    (country) => normalizeCountryName(country.name) === normalizedTarget,
  );
  if (exactMatch) {
    return exactMatch;
  }

  const partialMatch = projectedMap.countries.find((country) =>
    normalizeCountryName(country.name).includes(normalizedTarget),
  );

  return partialMatch ?? null;
};

export const projectWorldMap = ({
  width,
  height,
  padding = 40,
}: {
  width: number;
  height: number;
  padding?: number;
}): ProjectedWorldMap => {
  const projection = geoNaturalEarth1().fitExtent(
    [
      [padding, padding],
      [width - padding, height - padding],
    ],
    countryCollection,
  );
  const pathBuilder = geoPath(projection);

  return {
    width,
    height,
    landPath: pathBuilder(landFeature) ?? "",
    bordersPath: pathBuilder(borderMesh) ?? "",
    countries: WORLD_COUNTRY_FEATURES.map((country) => ({
      id: String(country.id ?? country.properties?.name ?? ""),
      name: country.properties?.name ?? "",
      path: pathBuilder(country) ?? "",
      centroid: pathBuilder.centroid(country) as [number, number],
    })).filter((country) => country.path.length > 0),
  };
};
