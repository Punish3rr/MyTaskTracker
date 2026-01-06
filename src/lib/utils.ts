import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getIdleAgeColor(idleAge: number): string {
  if (idleAge < 3) return 'text-green-400';
  if (idleAge < 7) return 'text-yellow-400';
  return 'text-red-400';
}

export function getIdleAgeBadge(idleAge: number): string {
  if (idleAge === 0) return 'Fresh';
  if (idleAge === 1) return '1 day';
  return `${idleAge} days`;
}

export function getFileTypeIcon(ext: string): string {
  if (['pdf'].includes(ext)) return '📄';
  if (['doc', 'docx'].includes(ext)) return '📝';
  if (['xls', 'xlsx'].includes(ext)) return '📊';
  if (['zip', 'rar', '7z'].includes(ext)) return '📦';
  return '📎';
}

