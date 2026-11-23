import os
import pymongo
from database.admin_collection import AdminCollectionManager


class AdminDatabase:
    """Central database gateway for the Kafeh Fekr Admin Backend."""

    def __init__(self):
        mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
        self.client = pymongo.MongoClient(mongo_uri)
        self.db = self.client["KafehFekrDB"]

        # Collections
        self.users = self.db["users"]
        self.user_history = self.db["user_history"]
        self.game_play_history = self.db["game_play_history"]
        self.game_history = self.db["game_history"]
        self.purchases = self.db["purchases"]
        self.config = self.db["config"]
        self.clans = self.db["clans"]
        self.clan_members = self.db["clan_members"]
        self.clan_challenges = self.db["clan_challenges"]
        self.social_reports = self.db["social_reports"]
        self.notifications = self.db["notifications"]
        self.social_notifications = self.db["social_notifications"]
        self.admin_broadcasts = self.db["admin_broadcasts"]
        self.admins_col = self.db["admins"]
        self.audit_logs = self.db["admin_audit_logs"]
        self.questions = self.db["questions"]
        self.promo_codes = self.db["promo_codes"]
        self.promo_redemptions = self.db["promo_redemptions"]

        self.admin_manager = AdminCollectionManager(self.admins_col)

    def init_database(self):
        try:
            default_user = (os.getenv("DEFAULT_ADMIN_USERNAME") or os.getenv("DEFAULT_ADMIN_USER") or "admin").strip()
            default_pass = os.getenv("DEFAULT_ADMIN_PASSWORD", "admin123456").strip()
            self.admin_manager.ensure_default_superadmin(default_user, default_pass)
            self.promo_codes.create_index("code", unique=True)
            self.promo_redemptions.create_index([("promo_id", 1), ("user_id", 1)])
        except Exception as e:
            print(f"[AdminDatabase] Init notice: {e}")


db = AdminDatabase()
