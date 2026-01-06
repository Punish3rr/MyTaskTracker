// File handling utilities for attachments
import { app, shell, clipboard } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'fs';

export function getAttachmentAbsolutePath(relativePath: string): string {
  const userDataPath = app.getPath('userData');
  const attachmentsDir = join(userDataPath, 'taskvault', 'attachments');
  return join(attachmentsDir, relativePath);
}

export async function processFileAttachment(taskId: string, filePath: string): Promise<string> {
  const userDataPath = app.getPath('userData');
  const attachmentsDir = join(userDataPath, 'taskvault', 'attachments', taskId);
  
  if (!existsSync(attachmentsDir)) {
    mkdirSync(attachmentsDir, { recursive: true });
  }

  const filename = filePath.split(/[/\\]/).pop() || 'file';
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const relativePath = `${taskId}/${safeFilename}`;
  const absolutePath = getAttachmentAbsolutePath(relativePath);

  const sourceBuffer = readFileSync(filePath);
  writeFileSync(absolutePath, sourceBuffer);

  return relativePath;
}

export async function processImagePaste(taskId: string, imageBuffer: Buffer): Promise<string> {
  const userDataPath = app.getPath('userData');
  const attachmentsDir = join(userDataPath, 'taskvault', 'attachments', taskId);
  
  if (!existsSync(attachmentsDir)) {
    mkdirSync(attachmentsDir, { recursive: true });
  }

  const timestamp = Date.now();
  const relativePath = `${taskId}/paste_${timestamp}.png`;
  const absolutePath = getAttachmentAbsolutePath(relativePath);

  writeFileSync(absolutePath, imageBuffer);
  return relativePath;
}

export async function openAttachment(relativePath: string): Promise<void> {
  const absolutePath = getAttachmentAbsolutePath(relativePath);
  if (existsSync(absolutePath)) {
    await shell.openPath(absolutePath);
  } else {
    console.error('Attachment not found:', absolutePath);
  }
}

export async function revealAttachment(relativePath: string): Promise<void> {
  const absolutePath = getAttachmentAbsolutePath(relativePath);
  if (existsSync(absolutePath)) {
    await shell.showItemInFolder(absolutePath);
  } else {
    console.error('Attachment not found:', absolutePath);
  }
}

export async function copyAttachmentPath(relativePath: string): Promise<void> {
  const absolutePath = getAttachmentAbsolutePath(relativePath);
  clipboard.writeText(absolutePath);
}

export async function deleteAttachment(relativePath: string): Promise<void> {
  const absolutePath = getAttachmentAbsolutePath(relativePath);
  if (existsSync(absolutePath)) {
    try {
      unlinkSync(absolutePath);
    } catch (error) {
      console.error(`Failed to delete attachment ${relativePath}:`, error);
      throw error;
    }
  }
}
