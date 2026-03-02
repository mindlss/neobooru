/**
 * permission-keys.
 * Used in:
 * - @Security(...)
 * - Services
 * - Seed
 */
export enum Permission {
    // ---------------- users ----------------

    /** Read basic user profile */
    USERS_READ = 'users.read',

    /** View soft-deleted users */
    USERS_READ_DELETED = 'users.read_deleted',

    /** Read private profile sections (uploads/favorites/comments/ratings) even if hidden */
    USERS_READ_PRIVATE = 'users.read_private',

    /** Update own profile settings */
    USERS_UPDATE_SELF = 'users.update_self',

    /** Update own avatar */
    USERS_AVATAR_UPDATE_SELF = 'users.avatar_update_self',

    /** Ban/unban users */
    USERS_BAN = 'users.ban',

    /** Assign roles to users */
    ROLES_ASSIGN = 'roles.assign',

    // ---------------- media visibility ----------------

    /** View soft-deleted media */
    MEDIA_READ_DELETED = 'media.read_deleted',

    /** View unmoderated / rejected media */
    MEDIA_READ_UNMODERATED = 'media.read_unmoderated',

    /** View explicit media even if viewer is not adult */
    MEDIA_READ_EXPLICIT = 'media.read_explicit',

    /** Use any media in features (e.g. comics), bypass ownership */
    MEDIA_USE_ANY = 'media.use_any',

    /** Use only own media in features */
    MEDIA_USE_OWN = 'media.use_own',

    /** Upload media */
    MEDIA_UPLOAD = 'media.upload',

    // ---------------- comics ----------------

    /** Create comics (base entitlement) */
    COMICS_CREATE = 'comics.create',

    /** Read comics you own (base entitlement) */
    COMICS_READ_OWN = 'comics.read_own',

    /** Read any comic (moderation/staff) */
    COMICS_READ_ANY = 'comics.read_any',

    /** Edit comics you own */
    COMICS_EDIT_OWN = 'comics.edit_own',

    /** Edit any comic (moderation/staff) */
    COMICS_EDIT_ANY = 'comics.edit_any',

    // ---------------- Comments ----------------

    /** List comments on media */
    COMMENTS_READ = 'comments.read',

    /** View deleted comment reason (moderation details) */
    COMMENTS_READ_DELETION_REASON = 'comments.read_deletion_reason',

    /** Create comment */
    COMMENTS_CREATE = 'comments.create',

    /** Delete own comment */
    COMMENTS_DELETE_OWN = 'comments.delete_own',

    /** Delete any comment (moderation) */
    COMMENTS_DELETE_ANY = 'comments.delete_any',

    // ---------------- Ratings ----------------

    /** Set/overwrite rating */
    RATINGS_SET = 'ratings.set',

    /** Remove rating */
    RATINGS_REMOVE = 'ratings.remove',

    // ---------------- Favorites ----------------

    /** Add to favorites */
    FAVORITES_ADD = 'favorites.add',

    /** Remove from favorites */
    FAVORITES_REMOVE = 'favorites.remove',

    // ---------------- Moderation ----------------

    /** Read report queue */
    MODERATION_QUEUE_READ = 'moderation.queue_read',

    /** Approve media */
    MODERATION_MEDIA_APPROVE = 'moderation.media_approve',

    /** Reject media */
    MODERATION_MEDIA_REJECT = 'moderation.media_reject',

    // ---------------- Reports ----------------

    /** Create report */
    REPORTS_CREATE = 'reports.create',

    /** Access to reports */
    REPORTS_ADMIN_READ = 'reports.admin_read',

    /** Permission to answer to reports (take action) */
    REPORTS_ADMIN_UPDATE = 'reports.admin_update',

    // ---------------- Jobs ----------------

    /** Run and view internal jobs */
    JOBS_RUN = 'jobs.run',

    // ---------------- Tags ----------------

    /** Create/update tags (color, explicit, etc.) */
    TAGS_MANAGE = 'tags.manage',

    /** Manage tag aliases (create/delete/list for moderation) */
    TAGS_ALIASES_MANAGE = 'tags.aliases_manage',

    /** Edit tags on any media (staff) */
    MEDIA_TAGS_EDIT_ANY = 'media.tags_edit_any',

    /** Edit tags on own media */
    MEDIA_TAGS_EDIT_OWN = 'media.tags_edit_own',
}

export enum Scope {
    /** Service scope: forces loading permissions into req.user.permissions */
    LOAD_PERMISSIONS = 'auth.load_permissions',
}
