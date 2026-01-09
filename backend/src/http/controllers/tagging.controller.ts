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

    res.json({ data: tags.map(toTagSearchDTO) });
});

export const create = asyncHandler(async (req, res) => {
    const body = createTagSchema.parse(req.body);
    const tag = await createTag(body);

    res.status(201).json(toTagAdminDTO(tag));
});

export const patch = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const body = patchTagSchema.parse(req.body);

    try {
        const updated = await patchTag(id, body);
        res.json(toTagAdminDTO(updated));
    } catch {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
    }
});
