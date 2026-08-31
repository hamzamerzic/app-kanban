export function boardAccess(share, online) {
  if (!share) {
    return {
      canWrite: true,
      status: online ? '' : 'Offline — changes will sync',
    }
  }
  if (!online) {
    return {
      canWrite: false,
      status: 'Offline — shared board is read-only',
    }
  }
  if (share.role === 'viewer') {
    return {
      canWrite: false,
      status: 'View only',
    }
  }
  return { canWrite: true, status: '' }
}

export const invitationKey = invitation => `${invitation.host}:${invitation.id}`
