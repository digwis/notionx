// Generic Notion property mappers. Re-exported here so consumers can
// import them as a single group. Blog/movies specific mappers (that depend
// on a concrete content model) live in the consuming application.
export {
  getAuthorProperty,
  getCheckboxProperty,
  getDateProperty,
  getFirstDateProperty,
  getFirstPeopleProperty,
  getFirstTagsProperty,
  getFirstTitleProperty,
  getRelationPageIds,
  getRichTextProperty,
  getSelectProperty,
  getTagsProperty,
  isRecord,
  isValidPublicSlug,
  notionPageEditUrl,
  pickDescriptionFallback,
  pickPublishedFlag,
  compactNotionId,
} from "./property-mappers";
