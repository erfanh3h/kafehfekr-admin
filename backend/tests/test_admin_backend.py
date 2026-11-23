import io
import os
import sys
import tempfile
import types
import unittest
import zipfile

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)


def _install_lightweight_stubs_if_needed():
    """Allows running pure backend logic tests even when FastAPI/PyMongo aren't installed locally."""
    if "fastapi" not in sys.modules:
        try:
            import fastapi  # noqa: F401
        except ImportError:
            fa = types.ModuleType("fastapi")
            fa_resp = types.ModuleType("fastapi.responses")

            class HTTPException(Exception):
                def __init__(self, status_code=500, detail="", headers=None):
                    super().__init__(detail)
                    self.status_code = status_code
                    self.detail = detail
                    self.headers = headers

            class _Route:
                def __init__(self, path):
                    self.path = path

            class APIRouter:
                def __init__(self, prefix="", tags=None):
                    self.prefix = prefix
                    self.routes = []

                def _reg(self, path):
                    def dec(fn):
                        self.routes.append(_Route(self.prefix + path))
                        return fn
                    return dec

                get = _reg
                post = _reg
                put = _reg
                delete = _reg

            fa.HTTPException = HTTPException
            fa.APIRouter = APIRouter
            fa.Depends = lambda x=None: x
            fa.Header = lambda x=None: x
            fa.Query = lambda x=None: x
            fa.status = types.SimpleNamespace(
                HTTP_401_UNAUTHORIZED=401,
                HTTP_403_FORBIDDEN=403,
            )
            fa_resp.Response = object
            sys.modules["fastapi"] = fa
            sys.modules["fastapi.responses"] = fa_resp

    if "pydantic" not in sys.modules:
        try:
            import pydantic  # noqa: F401
        except ImportError:
            pyd = types.ModuleType("pydantic")
            pyd.BaseModel = type("BaseModel", (), {})
            pyd.Field = lambda *a, **kw: None
            sys.modules["pydantic"] = pyd

    if "jose" not in sys.modules:
        try:
            import jose  # noqa: F401
        except ImportError:
            j = types.ModuleType("jose")
            j.JWTError = Exception
            j.jwt = types.SimpleNamespace(encode=lambda *a, **kw: "stub", decode=lambda *a, **kw: {})
            sys.modules["jose"] = j

    if "passlib" not in sys.modules:
        try:
            import passlib  # noqa: F401
        except ImportError:
            pl = types.ModuleType("passlib")
            plc = types.ModuleType("passlib.context")

            class CryptContext:
                def __init__(self, **kw):
                    pass

                def hash(self, p):
                    return f"hash:{p}"

                def verify(self, p, h):
                    return h == f"hash:{p}"

            plc.CryptContext = CryptContext
            sys.modules["passlib"] = pl
            sys.modules["passlib.context"] = plc

    if "bson" not in sys.modules:
        try:
            import bson  # noqa: F401
        except ImportError:
            b = types.ModuleType("bson")
            b.ObjectId = type("ObjectId", (), {})
            sys.modules["bson"] = b

    if "pymongo" not in sys.modules:
        try:
            import pymongo  # noqa: F401
        except ImportError:
            pm = types.ModuleType("pymongo")
            pm.ASCENDING = 1
            pm.DESCENDING = -1

            class _FakeCol:
                def create_index(self, *a, **kw):
                    return None

                def insert_one(self, *a, **kw):
                    return None

                def find(self, *a, **kw):
                    return []

                def find_one(self, *a, **kw):
                    return None

                def count_documents(self, *a, **kw):
                    return 0

            class _FakeDb:
                def __getitem__(self, _name):
                    return _FakeCol()

            class _FakeClient:
                def __init__(self, *_a, **_kw):
                    pass

                def __getitem__(self, _name):
                    return _FakeDb()

            pm.MongoClient = _FakeClient
            sys.modules["pymongo"] = pm


_install_lightweight_stubs_if_needed()


class AdminBackendUnitTests(unittest.TestCase):
    def test_rbac_has_permission(self):
        from security import has_permission

        superadmin = {"role": "superadmin", "permissions": []}
        self.assertTrue(has_permission(superadmin, "admins:manage"))
        self.assertTrue(has_permission(superadmin, "system:backup"))

        support = {"role": "support", "permissions": ["dashboard:read", "users:read"]}
        self.assertTrue(has_permission(support, "users:read"))
        self.assertFalse(has_permission(support, "users:write"))
        self.assertFalse(has_permission(support, "economy:write"))

        ns_admin = {"role": "admin", "permissions": ["clans:*"]}
        self.assertTrue(has_permission(ns_admin, "clans:manage"))
        self.assertFalse(has_permission(ns_admin, "config:write"))
        self.assertFalse(has_permission(None, "dashboard:read"))

    def test_regex_escape_protects_special_chars(self):
        from services.admin_service import _escape_regex

        raw = "user(1)[test]*+$"
        escaped = _escape_regex(raw)
        self.assertIn(r"\(", escaped)
        self.assertIn(r"\[", escaped)
        self.assertIn(r"\*", escaped)

    def test_backup_dir_size_zip_and_path_traversal_guard(self):
        from fastapi import HTTPException
        from services.admin_service import (
            _get_path_size_and_files,
            create_backup_zip_bytes,
            list_system_backups,
            delete_system_backup,
        )

        with tempfile.TemporaryDirectory() as tmpdir:
            old_env = os.environ.get("BACKUP_DIR")
            os.environ["BACKUP_DIR"] = tmpdir
            try:
                snap = os.path.join(tmpdir, "backup_20261120_100000")
                os.makedirs(snap, exist_ok=True)
                with open(os.path.join(snap, "users.bson"), "wb") as f:
                    f.write(b"x" * 2048)
                with open(os.path.join(snap, "config.bson"), "wb") as f:
                    f.write(b"y" * 1024)

                size, count = _get_path_size_and_files(snap)
                self.assertEqual(size, 3072)
                self.assertEqual(count, 2)

                listed = list_system_backups()
                self.assertEqual(len(listed), 1)
                self.assertEqual(listed[0]["size_bytes"], 3072)
                self.assertEqual(listed[0]["file_count"], 2)

                zip_bytes, dl_name = create_backup_zip_bytes("backup_20261120_100000")
                self.assertEqual(dl_name, "backup_20261120_100000.zip")
                with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as zf:
                    names = zf.namelist()
                    self.assertTrue(any(n.endswith("users.bson") for n in names))
                    self.assertTrue(any(n.endswith("config.bson") for n in names))

                # Path traversal must be rejected with 400
                with self.assertRaises(HTTPException) as ctx:
                    create_backup_zip_bytes("../etc/passwd")
                self.assertEqual(ctx.exception.status_code, 400)

                res = delete_system_backup("backup_20261120_100000", admin_id="adm_test")
                self.assertEqual(res["status"], "deleted")
                self.assertEqual(list_system_backups(), [])
            finally:
                if old_env is None:
                    os.environ.pop("BACKUP_DIR", None)
                else:
                    os.environ["BACKUP_DIR"] = old_env

    def test_fastapi_routes_registered(self):
        from routers.admin_router import router

        paths = {route.path for route in router.routes}
        expected = {
            "/admin/analytics",
            "/admin/users/bulk-reset-locks",
            "/admin/users/{user_id}/force-logout",
            "/admin/config/maintenance",
            "/admin/clans/{clan_id}/members/{user_id}",
            "/admin/notifications/send",
            "/admin/notifications/history",
            "/admin/system/backups/{filename}/download",
            "/admin/system/backups/{filename}",
            "/admin/system/runtime-status",
            "/admin/questions",
            "/admin/questions/categories",
            "/admin/questions/bulk-import",
            "/admin/questions/{question_id}",
            "/admin/promos",
            "/admin/promos/{promo_id}",
            "/admin/promos/{promo_id}/redemptions",
        }
        for path in expected:
            self.assertIn(path, paths, f"Missing route: {path}")

    def test_question_and_promo_validation(self):
        from fastapi import HTTPException
        from services.admin_service import _validate_question_payload, _normalize_promo_code

        valid = _validate_question_payload({
            "question": "پایتخت ایران کجاست؟",
            "options": ["تهران", "شیراز", "اصفهان", "تبریز"],
            "correct": 0,
            "category_id": 1,
            "category_title": "جغرافیا",
        })
        self.assertEqual(valid["correct"], 0)
        self.assertEqual(len(valid["options"]), 4)

        with self.assertRaises(HTTPException):
            _validate_question_payload({
                "question": "سوال تستی معتبر",
                "options": ["الف", "ب"],
                "correct": 0,
            })

        with self.assertRaises(HTTPException):
            _validate_question_payload({
                "question": "سوال تستی معتبر",
                "options": ["الف", "ب", "ج", "د"],
                "correct": 5,
            })

        self.assertEqual(_normalize_promo_code(" nowruz-2026! "), "NOWRUZ-2026")
        with self.assertRaises(HTTPException):
            _normalize_promo_code("ab")


if __name__ == "__main__":
    unittest.main()
