'use server';

// Auth actions reset to minimal state
export async function login(_key?: string) {
  return { success: true };
}

export async function checkAuth() {
  return { isAuthenticated: true };
}
