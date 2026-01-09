import { asyncHandler } from '../utils/asyncHandler';
import {
    tagNamesSchema,
    tagSearchSchema,
    createTagSchema,
    patchTagSchema,
} from '../schemas/tagging.schemas';
import {
    addTagsToMedia,
    removeTagsFromMedia,
    setTagsForMedia,
    searchTags,
    createTag,
    patchTag,
} from '../../domain/tags/tagging.service';
import { toTagAdminDTO, toTagSearchDTO } from '../dto';
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
    const tags = await searchTags(q.q, q.limit);

    res.json({ data: tags.map(toTagSearchDTO) });
});

export const create = asyncHandler(async (req, res) => {
    const body = parseBody(createTagSchema, req.body);
    const tag = await createTag(body);

    res.status(201).json(toTagAdminDTO(tag));
});

export const patch = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const body = parseBody(patchTagSchema, req.body);

    const updated = await patchTag(id, body);
    res.json(toTagAdminDTO(updated));
});
