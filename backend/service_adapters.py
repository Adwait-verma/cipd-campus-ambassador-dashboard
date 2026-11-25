"""Isolate request budgeting from the original platform helper implementations."""
from types import FunctionType


class RequestAdapter:
    def __init__(self, original, get):
        self.original, self.get = original, get

    def __getattr__(self, name):
        return getattr(self.original, name)


def call_with_get(function, get, *args):
    if get is None:
        return function(*args)
    # Execute the original function code with a private globals dictionary.
    # Never replace requests.get globally: concurrent OAuth requests stay intact.
    namespace = dict(function.__globals__)
    namespace['requests'] = RequestAdapter(namespace['requests'], get)
    isolated = FunctionType(function.__code__, namespace, function.__name__,
                            function.__defaults__, function.__closure__)
    isolated.__kwdefaults__ = function.__kwdefaults__
    return isolated(*args)


class ServiceAPI:
    def __init__(self, original):
        self.original = original

    def __getattr__(self, name):
        return getattr(self.original, name)

    def get_valid_instagram_token(self, ambassador_id, conn, http_get=None):
        return call_with_get(self.original.get_valid_instagram_token, http_get, ambassador_id, conn)

    def resolve_instagram_media_id(self, access_token, post_url, http_get=None):
        return call_with_get(self.original.resolve_instagram_media_id, http_get, access_token, post_url)
