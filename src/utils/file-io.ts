import { promises as fs } from 'fs';
import { dirname, join } from 'path';

/**
 * Read a JSON file and parse it to the specified type
 */
export async function readJSON<T>(path: string): Promise<T> {
  try {
    const content = await fs.readFile(path, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`File not found: ${path}`);
    }
    throw new Error(`Failed to read JSON from ${path}: ${error}`);
  }
}

/**
 * Write data to a JSON file with pretty formatting
 */
export async function writeJSON(path: string, data: unknown): Promise<void> {
  try {
    await ensureDir(dirname(path));
    await fs.writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    throw new Error(`Failed to write JSON to ${path}: ${error}`);
  }
}

/**
 * Read a markdown file as a string
 */
export async function readMarkdown(path: string): Promise<string> {
  try {
    return await fs.readFile(path, 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`File not found: ${path}`);
    }
    throw new Error(`Failed to read markdown from ${path}: ${error}`);
  }
}

/**
 * Write a string to a markdown file
 */
export async function writeMarkdown(path: string, content: string): Promise<void> {
  try {
    await ensureDir(dirname(path));
    await fs.writeFile(path, content, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to write markdown to ${path}: ${error}`);
  }
}

/**
 * Ensure a directory exists, creating it if necessary
 */
export async function ensureDir(path: string): Promise<void> {
  try {
    await fs.mkdir(path, { recursive: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw new Error(`Failed to create directory ${path}: ${error}`);
    }
  }
}

/**
 * Check if a file exists
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the absolute path to a file in the nova directory
 */
export function getNovaPath(...segments: string[]): string {
  const novaPath = join(process.cwd(), '.nova', ...segments);
  return novaPath;
}

/**
 * Get the absolute path to a file in the src directory
 */
export function getSrcPath(...segments: string[]): string {
  const srcPath = join(process.cwd(), 'src', ...segments);
  return srcPath;
}
