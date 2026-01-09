import { asyncHandler } from '../utils/asyncHandler';
import {
    tagNamesSchema,
    tagSearchSchema,
    createTagSchema,
} from '../schemas/tagging.schemas';
import {
    addTagsToMedia,
    removeTagsFromMedia,
    setTagsForMedia,
    searchTags,
    createTag,
} from '../../domain/tags/tagging.service';

export const addTags = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const body = tagNamesSchema.parse(req.body);

    await addTagsToMedia(id, body.tags);
    res.json({ status: 'ok' });
});

export const removeTags = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const body = tagNamesSchema.parse(req.body);

    await removeTagsFromMedia(id, body.tags);
    res.json({ status: 'ok' });
});

export const setTags = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const body = tagNamesSchema.parse(req.body);

    await setTagsForMedia(id, body.tags);
    res.json({ status: 'ok' });
});

export const search = asyncHandler(async (req, res) => {
    const q = tagSearchSchema.parse(req.query);
    const tags = await searchTags(q.q, q.limit);
    res.json({ data: tags });
});

export const create = asyncHandler(async (req, res) => {
    const body = createTagSchema.parse(req.body);
    const tag = await createTag(body);
    res.status(201).json(tag);
});
