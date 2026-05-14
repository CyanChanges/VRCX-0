export function sanitizeLoginRedirectTarget(value: any) {
    if (
        typeof value !== 'string' ||
        !value.startsWith('/') ||
        value.startsWith('/login')
    ) {
        return '/feed';
    }

    return value;
}

export function getSnapshotLoginParams(nextSnapshot: any) {
    const lastUserId = nextSnapshot?.lastUserLoggedIn || '';
    const lastCredential = lastUserId
        ? nextSnapshot?.savedCredentials?.[lastUserId]
        : null;
    const firstCredential = Array.isArray(nextSnapshot?.savedCredentialsList)
        ? nextSnapshot.savedCredentialsList[0]
        : null;
    return lastCredential?.loginParams || firstCredential?.loginParams || {};
}
