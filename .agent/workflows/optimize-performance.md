---
description: Continuous Performance Optimization
---

# Continuous Performance Optimization

Guidelines to ensure Gamelogd remains blazingly fast and scales effortlessly to millions of users without server crashes.

## 1. Backend Optimization (Django/PostgreSQL)
- **Eliminate N+1 Queries:** When returning lists of data in a `ViewSet` (e.g., Posts, Reviews, LibraryEntries), NEVER let the serializer query the database individually for related fields.
  - *Rule:* Always use `.select_related('foreign_key')` for `ForeignKey` relationships (e.g., `user`, `game`).
  - *Rule:* Always use `.prefetch_related('many_to_many')` for `ManyToManyField` or reverse relationships.
- **Database Indexing:** Any column that is frequently filtered against (`.filter(status=...)`) or ordered by (`.order_by('-timestamp')`) MUST have `db_index=True` in its model definition.
- **Queryset Truncation:** Limit the size of query results using pagination (`PageNumberPagination`) or slicing (`[:20]`) on public feeds so the frontend isn't overwhelmed by giant arrays.

## 2. Frontend Optimization (Next.js)
- **Image Handling:** When loading user-uploaded images or heavy game covers, prefer lazy-loading. Standard `<img>` tags for external sources (Steam, IGDB) are permissible but should include `loading="lazy"`.
- **Client vs Server Components:** Keep interactive components (using `useState`, `onClick`, `useEffect`) pushed as far down the React tree as possible. Keep entire layouts and data-fetching pages as "Server Components" (`"use server";` or strictly non-client) to drastically reduce the JavaScript bundle size shipped to the client's phone/browser.
- **Caching:** Cache heavy algorithmic computations (like compiling "Recommended Games") using `localStorage` on the frontend. Do not make the backend recalculate heavy suggestions on every micro-navigation.
