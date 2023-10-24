import path from "path";

export const baseDir = process.cwd();
export const directories = {
    worlds: path.join(baseDir, "public", "worlds"),
    avatars: path.join(baseDir, "public", "User Avatars"),
    groups: path.join(baseDir, "public", "groups"),
    groupChats: path.join(baseDir, "public", "group chats"),
    chats: path.join(baseDir, "public", "chats"),
    characters: path.join(baseDir, "public", "characters"),
    backgrounds: path.join(baseDir, "public", "backgrounds"),
    openAI_Settings: path.join(baseDir, "public", "OpenAI Settings"),
    textGen_Settings: path.join(baseDir, "public", "TextGen Settings"),
    thumbnails: path.join(baseDir, "thumbnails"),
    thumbnailsBg: path.join(baseDir, "thumbnails", "bg"),
    thumbnailsAvatar: path.join(baseDir, "thumbnails", "avatar"),
    themes: path.join(baseDir, "public", "themes"),
    extensions: path.join(baseDir, "public", "scripts", "extensions"),
    context: path.join(baseDir, "public", "context"),
    backups: path.join(baseDir, "backups"),
    quickreplies: path.join(baseDir, "public", "QuickReplies"),
    uploads: path.join(baseDir, "uploads"),
};
