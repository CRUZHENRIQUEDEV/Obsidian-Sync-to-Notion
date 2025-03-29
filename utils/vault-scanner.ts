import { TFile, TFolder, Vault } from "obsidian";

export interface VaultFile {
  file: TFile;
  path: string;
  name: string;
  parent: string;
}

/**
 * Scans the Obsidian vault and returns all markdown files
 * organized with their path information
 */
export async function scanVault(
  vault: Vault,
  excludeFolders: string[] = []
): Promise<VaultFile[]> {
  const files: VaultFile[] = [];
  const markdownFiles = vault.getMarkdownFiles();

  for (const file of markdownFiles) {
    // Check if file is in an excluded folder
    if (isInExcludedFolder(file.path, excludeFolders)) {
      continue;
    }

    const pathParts = file.path.split("/");
    const fileName = pathParts.pop() || "";
    const parentPath = pathParts.join("/");

    files.push({
      file,
      path: file.path,
      name: fileName.replace(".md", ""),
      parent: parentPath,
    });
  }

  return files;
}

/**
 * Checks if a path is inside an excluded folder
 */
function isInExcludedFolder(path: string, excludeFolders: string[]): boolean {
  return excludeFolders.some(
    (folder) => path === folder || path.startsWith(folder + "/")
  );
}

/**
 * Builds a hierarchy map with folder structure
 */
export function buildFolderHierarchy(
  files: VaultFile[]
): Record<string, string[]> {
  const hierarchy: Record<string, string[]> = {
    "": [], // Root
  };

  // First, build all folders in the map
  files.forEach((file) => {
    const parts = file.parent.split("/");
    let currentPath = "";

    // Create entry for each folder level
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;

      const parentPath = parts.slice(0, i).join("/");
      const fullPath = parts.slice(0, i + 1).join("/");

      if (!hierarchy[parentPath]) {
        hierarchy[parentPath] = [];
      }

      if (!hierarchy[fullPath]) {
        hierarchy[fullPath] = [];
        if (!hierarchy[parentPath].includes(part)) {
          hierarchy[parentPath].push(part);
        }
      }
    }

    // Add file to its parent directory
    if (!hierarchy[file.parent]) {
      hierarchy[file.parent] = [];
    }

    hierarchy[file.parent].push(file.name);
  });

  return hierarchy;
}
