import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function calculateCompliancePercentage(
  compliant: number,
  nonCompliant: number,
  _notApplicable: number
): number {
  const total = compliant + nonCompliant
  if (total === 0) return 0
  return Math.round((compliant / total) * 100 * 10) / 10
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    C: 'text-compliant bg-compliant/10',
    NC: 'text-non-compliant bg-non-compliant/10',
    NA: 'text-not-applicable bg-not-applicable/10',
    NV: 'text-not-verified bg-not-verified/10',
    Draft: 'text-muted-foreground bg-muted',
    'In Progress': 'text-in-progress bg-in-progress/10',
    'Pending Review': 'text-pending bg-pending/10',
    Approved: 'text-compliant bg-compliant/10',
    Closed: 'text-muted-foreground bg-muted',
    Rejected: 'text-non-compliant bg-non-compliant/10',
  }
  return colors[status] || 'text-muted-foreground bg-muted'
}

export function getRiskColor(rating: string): string {
  const colors: Record<string, string> = {
    Critical: 'text-critical bg-critical/10',
    Major: 'text-major bg-major/10',
    Minor: 'text-minor bg-minor/10',
    Observation: 'text-observation bg-observation/10',
  }
  return colors[rating] || 'text-muted-foreground bg-muted'
}
