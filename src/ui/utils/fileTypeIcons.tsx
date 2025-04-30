import React from "react";
import {
  File,
  FileText,
  FileCode,
  FileJson,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileSpreadsheet,
  Database,
  FileTerminal,
  FileType,
  FileCog,
  FileOutput,
  Presentation,
} from "lucide-react";

/**
 * Maps file extensions to appropriate Lucide icon components
 * @param extension File extension (without the dot)
 * @returns A React component for the file type icon
 */
export const getFileTypeIcon = (filePath: string): React.ReactElement => {
  // Extract extension from file path
  const extension = filePath.split(".").pop()?.toLowerCase() || "";

  // Map extensions to icons
  switch (extension) {
    // Code files
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
    case "py":
    case "java":
    case "c":
    case "cpp":
    case "cs":
    case "go":
    case "rb":
    case "php":
    case "swift":
    case "kt":
    case "rs":
      return <FileCode size={16} />;

    // Markup and style files
    case "html":
    case "htm":
    case "xml":
    case "svg":
    case "css":
    case "scss":
    case "less":
    case "sass":
      return <FileCode size={16} />;

    // Document files
    case "txt":
    case "md":
    case "rtf":
    case "doc":
    case "docx":
    case "odt":
    case "pdf":
      return <FileText size={16} />;

    // Data files
    case "json":
    case "yaml":
    case "yml":
    case "toml":
      return <FileJson size={16} />;

    // Image files
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "bmp":
    case "tiff":
    case "webp":
    case "ico":
      return <FileImage size={16} />;

    // Video files
    case "mp4":
    case "avi":
    case "mov":
    case "wmv":
    case "flv":
    case "webm":
    case "mkv":
      return <FileVideo size={16} />;

    // Audio files
    case "mp3":
    case "wav":
    case "ogg":
    case "flac":
    case "aac":
    case "m4a":
      return <FileAudio size={16} />;

    // Archive files
    case "zip":
    case "rar":
    case "7z":
    case "tar":
    case "gz":
    case "bz2":
      return <FileArchive size={16} />;

    // Spreadsheet files
    case "xls":
    case "xlsx":
    case "csv":
    case "ods":
      return <FileSpreadsheet size={16} />;

    // Presentation files
    case "ppt":
    case "pptx":
    case "odp":
      return <Presentation size={16} />;

    // Database files
    case "db":
    case "sqlite":
    case "sql":
      return <Database size={16} />;

    // Script files
    case "sh":
    case "bash":
    case "bat":
    case "cmd":
    case "ps1":
      return <FileTerminal size={16} />;

    // Font files
    case "ttf":
    case "otf":
    case "woff":
    case "woff2":
    case "eot":
      return <FileType size={16} />;

    // Config files
    case "config":
    case "conf":
    case "ini":
    case "env":
      return <FileCog size={16} />;

    // Log files
    case "log":
      return <FileOutput size={16} />;

    // Default for unknown file types
    default:
      return <File size={16} />;
  }
};
