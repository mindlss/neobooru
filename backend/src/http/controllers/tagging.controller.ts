import { asyncHandler } from '../utils/asyncHandler';
import {
    tagNamesSchema,
    tagSearchSchema,
    tagPopularSchema,
    createTagSchema,
    patchTagSchema,
    createAliasSchema,
} from '../schemas/tagging.schemas';
import {
    addTagsToMedia,
    removeTagsFromMedia,
    setTagsForMedia,
    searchTagsAutocomplete,
    listPopularTags,
    createTag,
    patchTag,
    createAlias,
    deleteAlias,
    listAliasesForTag,
} from '../../domain/tags/tagging.service';
import { toTagAdminDTO, toTagSuggestDTO, toTagSearchDTO } from '../dto';
import { parseBody, parseQuery } from '../utils/parse';

export const addTags = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const body = parseBody(tagNamesSchema, req.body);

    await addTagsToMedia(id, body.tags);
    res.json({ status: 'ok' });
});

export const removeTags = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const body = parseBody(tagNamesSchema, req.body);

    await removeTagsFromMedia(id, body.tags);
    res.json({ status: 'ok' });
});

export const setTags = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const body = parseBody(tagNamesSchema, req.body);

    await setTagsForMedia(id, body.tags);
    res.json({ status: 'ok' });
});

export const search = asyncHandler(async (req, res) => {
    const q = parseQuery(tagSearchSchema, req.query);

    const rows = await searchTagsAutocomplete({
        q: q.q,
        limit: q.limit,
        viewer: req.viewer,
    });

    res.json({ data: rows.map(toTagSuggestDTO) });
});

export const popular = asyncHandler(async (req, res) => {
    const q = parseQuery(tagPopularSchema, req.query);

    const tags = await listPopularTags({
        limit: q.limit,
        viewer: req.viewer,
    });

    res.json({ data: tags.map(toTagSearchDTO) });
});

export const create = asyncHandler(async (req, res) => {
    const body = parseBody(createTagSchema, req.body);
    const tag = await createTag(body);

    res.status(201).json(tag);
});

export const patch = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const body = parseBody(patchTagSchema, req.body);

    const updated = await patchTag(id, body);
    res.json(toTagAdminDTO(updated));
});

// aliases
export const createTagAlias = asyncHandler(async (req, res) => {
    const { id } = req.params; // tagId
    const body = parseBody(createAliasSchema, req.body);

    const created = await createAlias({ tagId: id, alias: body.alias });
    res.status(201).json(created);
});

export const listTagAliases = asyncHandler(async (req, res) => {
    const { id } = req.params; // tagId
    const rows = await listAliasesForTag(id);
    res.json({ data: rows });
});

export const deleteTagAlias = asyncHandler(async (req, res) => {
    const { id } = req.params; // aliasId
    await deleteAlias(id);
    res.json({ status: 'ok' });
});
