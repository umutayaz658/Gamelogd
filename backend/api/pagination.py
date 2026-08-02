from rest_framework.pagination import PageNumberPagination


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class LargeResultsSetPagination(PageNumberPagination):
    """For endpoints whose consumers legitimately need the whole set client-side (e.g. the
    localisation surfaces filter contributions by key/language in the browser) but must not
    be able to pull an unbounded single response."""
    page_size = 200
    page_size_query_param = 'page_size'
    max_page_size = 500
