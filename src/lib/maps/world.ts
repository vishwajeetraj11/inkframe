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

export interface ProjectedRegionalWorldMap extends ProjectedWorldMap {
  primaryCountry: ProjectedWorldCountry | null;
  secondaryCountry: ProjectedWorldCountry | null;
  sharedBorderPath: string;
  sharedBorderCentroid: [number, number] | null;
}

export type WorldMapPadding = number | { x: number; y: number };

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

const toProjectedPoint = (value: [number, number]): [number, number] | null =>
  Number.isFinite(value[0]) && Number.isFinite(value[1]) ? value : null;

const normalizePadding = (padding: WorldMapPadding | undefined): { x: number; y: number } => {
  if (typeof padding === "number") {
    return { x: padding, y: padding };
  }

  return {
    x: padding?.x ?? 40,
    y: padding?.y ?? 40,
  };
};

const toFeatureCollection = (
  features: WorldCountryFeature[],
): FeatureCollection<Geometry, CountryProperties> => ({
  type: "FeatureCollection",
  features,
});

const buildProjectedWorldMap = ({
  width,
  height,
  padding,
  focusCountries,
}: {
  width: number;
  height: number;
  padding?: WorldMapPadding;
  focusCountries?: WorldCountryFeature[];
}) => {
  const resolvedPadding = normalizePadding(padding);
  const fitTarget =
    focusCountries && focusCountries.length > 0
      ? toFeatureCollection(focusCountries)
      : countryCollection;
  const projection = geoNaturalEarth1().fitExtent(
    [
      [resolvedPadding.x, resolvedPadding.y],
      [width - resolvedPadding.x, height - resolvedPadding.y],
    ],
    fitTarget,
  );
  const pathBuilder = geoPath(projection);
  const projectedMap: ProjectedWorldMap = {
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

  return {
    pathBuilder,
    projectedMap,
  };
};

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

export const getSharedWorldBorderMesh = (
  firstCountryName: string,
  secondCountryName: string,
): MultiLineString | null => {
  const firstCountry = findWorldCountry(firstCountryName);
  const secondCountry = findWorldCountry(secondCountryName);

  if (
    !firstCountry ||
    !secondCountry ||
    String(firstCountry.id) === String(secondCountry.id)
  ) {
    return null;
  }

  const sharedBorder = mesh(
    topologyInput,
    meshCountriesObject,
    (left, right) =>
      left !== right &&
      ((String(left?.id) === String(firstCountry.id) &&
        String(right?.id) === String(secondCountry.id)) ||
        (String(left?.id) === String(secondCountry.id) &&
          String(right?.id) === String(firstCountry.id))),
  ) as MultiLineString;

  return sharedBorder.coordinates.length > 0 ? sharedBorder : null;
};

export const projectWorldMap = ({
  width,
  height,
  padding = 40,
  focusCountryNames = [],
}: {
  width: number;
  height: number;
  padding?: WorldMapPadding;
  focusCountryNames?: string[];
}): ProjectedWorldMap => {
  const focusCountries = focusCountryNames
    .map((countryName) => findWorldCountry(countryName))
    .filter((country): country is WorldCountryFeature => country !== null);

  return buildProjectedWorldMap({
    width,
    height,
    padding,
    focusCountries,
  }).projectedMap;
};

export const projectRegionalWorldMap = ({
  width,
  height,
  padding,
  primaryCountryName,
  secondaryCountryName,
}: {
  width: number;
  height: number;
  padding?: WorldMapPadding;
  primaryCountryName: string;
  secondaryCountryName?: string;
}): ProjectedRegionalWorldMap => {
  const primaryCountryFeature = findWorldCountry(primaryCountryName);
  const secondaryCountryFeature = secondaryCountryName
    ? findWorldCountry(secondaryCountryName)
    : null;
  const focusCountries = [
    primaryCountryFeature,
    secondaryCountryFeature,
  ].filter((country): country is WorldCountryFeature => country !== null);
  const { projectedMap, pathBuilder } = buildProjectedWorldMap({
    width,
    height,
    padding,
    focusCountries,
  });
  const primaryCountry = findProjectedWorldCountry(projectedMap, primaryCountryName);
  const secondaryCountry = secondaryCountryName
    ? findProjectedWorldCountry(projectedMap, secondaryCountryName)
    : null;
  const sharedBorder = secondaryCountryName
    ? getSharedWorldBorderMesh(primaryCountryName, secondaryCountryName)
    : null;
  const sharedBorderPath = sharedBorder ? pathBuilder(sharedBorder) ?? "" : "";
  const sharedBorderCentroid =
    sharedBorder && sharedBorderPath
      ? toProjectedPoint(pathBuilder.centroid(sharedBorder) as [number, number])
      : null;

  return {
    ...projectedMap,
    primaryCountry,
    secondaryCountry,
    sharedBorderPath,
    sharedBorderCentroid,
  };
};
