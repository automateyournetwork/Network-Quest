// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Public build paths only. Authentication configuration belongs to the PHP service.
export const publicPaths = Object.freeze({
  gameBase: import.meta.env.BASE_URL,
  apiBase: import.meta.env.VITE_API_BASE,
});
