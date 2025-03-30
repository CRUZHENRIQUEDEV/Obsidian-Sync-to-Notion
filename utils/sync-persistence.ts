import { Vault, TFile } from "obsidian";
import { createHash } from "crypto";

/**
 * Classe responsável por rastrear alterações em arquivos
 */
export class FileTracker {
  private fileHashes: Record<string, { hash: string; lastSync: number }>;

  constructor(
    initialTracking: Record<string, { hash: string; lastSync: number }> = {}
  ) {
    this.fileHashes = initialTracking;
  }

  /**
   * Calcula o hash MD5 do conteúdo de um arquivo
   */
  async calculateFileHash(content: string): Promise<string> {
    return createHash("md5").update(content).digest("hex");
  }

  /**
   * Verifica se um arquivo foi modificado desde a última sincronização
   */
  async hasFileChanged(file: TFile, vault: Vault): Promise<boolean> {
    // Se o arquivo nunca foi rastreado, consideramos como modificado
    if (!this.fileHashes[file.path]) {
      return true;
    }

    // Verifica a data de modificação do arquivo
    const lastModified = file.stat.mtime;
    const lastSync = this.fileHashes[file.path].lastSync;

    // Se a data de modificação for mais recente que a última sincronização, verificamos o hash
    if (lastModified > lastSync) {
      const content = await vault.read(file);
      const currentHash = await this.calculateFileHash(content);
      const storedHash = this.fileHashes[file.path].hash;

      return currentHash !== storedHash;
    }

    return false;
  }

  /**
   * Atualiza o hash e o timestamp de sincronização de um arquivo
   */
  async updateFileTracking(file: TFile, vault: Vault): Promise<void> {
    const content = await vault.read(file);
    const hash = await this.calculateFileHash(content);

    this.fileHashes[file.path] = {
      hash: hash,
      lastSync: Date.now(),
    };
  }

  /**
   * Retorna o mapeamento de todos os hashes
   */
  getAllTracking(): Record<string, { hash: string; lastSync: number }> {
    return { ...this.fileHashes };
  }

  /**
   * Remove arquivos excluídos do rastreamento
   */
  cleanupDeletedFiles(existingPaths: string[]): void {
    const pathSet = new Set(existingPaths);

    for (const path in this.fileHashes) {
      if (!pathSet.has(path)) {
        delete this.fileHashes[path];
      }
    }
  }
}
