"""
Tests for the Messaging Module.
Tests cover: encryption, template rendering, recipient resolution,
SMTP config CRUD, trigger CRUD, log filtering, and role-based access.
"""
import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timezone

# --- Unit Tests: Encryption ---

class TestEncryption:
    """Test Fernet encryption/decryption for SMTP passwords."""

    @patch("src.modules.messaging.service.settings")
    def test_encrypt_decrypt_roundtrip(self, mock_settings):
        from cryptography.fernet import Fernet
        key = Fernet.generate_key().decode()
        mock_settings.EMAIL_ENCRYPTION_KEY = key

        from src.modules.messaging.service import encrypt_password, decrypt_password

        original = "MySuperSecretPassword!@#123"
        encrypted = encrypt_password(original)

        assert encrypted != original
        assert decrypt_password(encrypted) == original

    @patch("src.modules.messaging.service.settings")
    def test_encrypt_produces_different_output_each_time(self, mock_settings):
        from cryptography.fernet import Fernet
        key = Fernet.generate_key().decode()
        mock_settings.EMAIL_ENCRYPTION_KEY = key

        from src.modules.messaging.service import encrypt_password

        password = "test_password"
        enc1 = encrypt_password(password)
        enc2 = encrypt_password(password)

        # Fernet produces different ciphertexts due to IV
        assert enc1 != enc2


# --- Unit Tests: Template Rendering ---

class TestTemplateRendering:
    """Test {{variable}} template substitution."""

    def test_simple_render(self):
        from src.modules.messaging.service import render_template

        template = "Olá {{nome}}, sua oportunidade {{numero}} foi criada."
        context = {"nome": "João", "numero": "OPP-001"}

        result = render_template(template, context)
        assert result == "Olá João, sua oportunidade OPP-001 foi criada."

    def test_render_with_missing_variable(self):
        from src.modules.messaging.service import render_template

        template = "Olá {{nome}}, valor: {{valor}}"
        context = {"nome": "Maria"}

        result = render_template(template, context)
        assert "Maria" in result
        assert "{{valor}}" in result  # Unreplaced variable stays

    def test_render_with_none_value(self):
        from src.modules.messaging.service import render_template

        template = "Status: {{status}}"
        context = {"status": None}

        result = render_template(template, context)
        assert result == "Status: "

    def test_render_empty_template(self):
        from src.modules.messaging.service import render_template

        result = render_template("", {"key": "value"})
        assert result == ""


# --- Unit Tests: Available Actions ---

class TestAvailableActions:
    """Ensure all declared actions have proper structure."""

    def test_all_actions_have_required_fields(self):
        from src.modules.messaging.service import AVAILABLE_ACTIONS

        assert len(AVAILABLE_ACTIONS) > 0

        for action in AVAILABLE_ACTIONS:
            assert "key" in action
            assert "label" in action
            assert "module" in action
            assert "." in action["key"]  # format: module.action

    def test_action_keys_are_unique(self):
        from src.modules.messaging.service import AVAILABLE_ACTIONS

        keys = [a["key"] for a in AVAILABLE_ACTIONS]
        assert len(keys) == len(set(keys))

    def test_all_actions_have_variables(self):
        from src.modules.messaging.service import AVAILABLE_ACTIONS

        for action in AVAILABLE_ACTIONS:
            assert "variables" in action
            assert isinstance(action["variables"], list)
            assert len(action["variables"]) > 0
            for var in action["variables"]:
                assert "name" in var
                assert "description" in var



# --- Unit Tests: Router Access Control ---

class TestRouterAccessControl:
    """Test that non-ADMIN users get 403."""

    def test_require_admin_raises_for_non_admin(self):
        from src.modules.messaging.router import _require_admin
        from fastapi import HTTPException

        mock_user = MagicMock()
        mock_role = MagicMock()
        mock_role.role.value = "ENGENHARIA_PRECO"
        mock_user.roles = [mock_role]

        with pytest.raises(HTTPException) as exc_info:
            _require_admin(mock_user)
        assert exc_info.value.status_code == 403

    def test_require_admin_passes_for_admin(self):
        from src.modules.messaging.router import _require_admin

        mock_user = MagicMock()
        mock_role = MagicMock()
        mock_role.role.value = "ADMIN"
        mock_user.roles = [mock_role]

        # Should not raise
        _require_admin(mock_user)


# --- Unit Tests: Model Enums ---

class TestModelEnums:
    """Test enum values are correct."""

    def test_recipients_type_enum(self):
        from src.modules.messaging.models import RecipientsTypeEnum

        assert RecipientsTypeEnum.FIXED.value == "FIXED"
        assert RecipientsTypeEnum.DYNAMIC.value == "DYNAMIC"
        assert RecipientsTypeEnum.ROLE_BASED.value == "ROLE_BASED"

    def test_email_status_enum(self):
        from src.modules.messaging.models import EmailStatusEnum

        assert EmailStatusEnum.PENDING.value == "PENDING"
        assert EmailStatusEnum.RETRYING.value == "RETRYING"
        assert EmailStatusEnum.SENT.value == "SENT"
        assert EmailStatusEnum.FAILED.value == "FAILED"


# --- Unit Tests: Schema Validation ---

class TestSchemaValidation:
    """Test Pydantic schema validation."""

    def test_email_config_create_valid(self):
        from src.modules.messaging.schemas import EmailConfigCreate

        config = EmailConfigCreate(
            smtp_host="smtp.gmail.com",
            smtp_port=587,
            smtp_user="test@gmail.com",
            smtp_password="app_password",
            smtp_use_tls=True,
            smtp_use_ssl=False,
            sender_name="Cerberus Test",
            sender_email="noreply@test.com",
        )
        assert config.smtp_host == "smtp.gmail.com"
        assert config.smtp_port == 587

    def test_email_config_create_invalid_port(self):
        from src.modules.messaging.schemas import EmailConfigCreate
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            EmailConfigCreate(
                smtp_host="smtp.gmail.com",
                smtp_port=99999,  # Invalid port
                smtp_user="test@gmail.com",
                smtp_password="pass",
                sender_name="Test",
                sender_email="noreply@test.com",
            )

    def test_email_trigger_create_valid(self):
        from src.modules.messaging.schemas import EmailTriggerCreate

        trigger = EmailTriggerCreate(
            action_key="opportunity.created",
            action_label="Nova Oportunidade",
            subject_template="Nova oportunidade: {{nome}}",
            body_template="<p>Oportunidade {{nome}} criada por {{usuario}}</p>",
            recipients_type="FIXED",
            recipients_fixed=["admin@test.com"],
        )
        assert trigger.action_key == "opportunity.created"

    def test_email_config_create_with_imap(self):
        from src.modules.messaging.schemas import EmailConfigCreate

        config = EmailConfigCreate(
            smtp_host="smtp.gmail.com",
            smtp_port=587,
            smtp_user="test@gmail.com",
            smtp_password="app_password",
            sender_name="Cerberus Test",
            sender_email="noreply@test.com",
            imap_host="imap.gmail.com",
            imap_port=993,
            imap_user="test@gmail.com",
            imap_password="app_password",
            imap_use_ssl=True,
            imap_use_tls=False,
        )
        assert config.imap_host == "imap.gmail.com"
        assert config.imap_port == 993
        assert config.imap_use_ssl is True

    def test_email_config_update_with_imap(self):
        from src.modules.messaging.schemas import EmailConfigUpdate

        config = EmailConfigUpdate(
            imap_host="imap.other.com",
            imap_port=143,
            imap_use_ssl=False,
            imap_use_tls=True,
        )
        assert config.imap_host == "imap.other.com"
        assert config.imap_port == 143
        assert config.imap_use_ssl is False
        assert config.imap_use_tls is True

    def test_email_test_request_with_live_smtp_fields(self):
        from src.modules.messaging.schemas import EmailTestRequest

        req = EmailTestRequest(
            recipient_email="test@test.com",
            smtp_host="smtp.gmail.com",
            smtp_port=587,
            smtp_user="user@gmail.com",
            smtp_password="app_password",
            smtp_use_tls=True,
            smtp_use_ssl=False,
        )
        assert req.smtp_host == "smtp.gmail.com"
        assert req.smtp_port == 587
        assert req.smtp_user == "user@gmail.com"
        assert req.smtp_password == "app_password"



# --- Unit Tests: Hooks ---

class TestHooks:
    """Test emit_messaging_event with mocked dependencies."""

    @patch("src.modules.messaging.hooks.get_active_config")
    def test_emit_skips_when_no_config(self, mock_get_config):
        from src.modules.messaging.hooks import emit_messaging_event

        mock_get_config.return_value = None
        mock_user = MagicMock()
        mock_user.tenant_id = "tenant-1"
        mock_db = MagicMock()
        mock_bg = MagicMock()

        # Should not raise, just skip
        emit_messaging_event(
            action_key="test.action",
            context={},
            source_module="test",
            user=mock_user,
            db=mock_db,
            background_tasks=mock_bg,
        )

        mock_bg.add_task.assert_not_called()

    @patch("src.modules.messaging.hooks.create_and_dispatch_email")
    @patch("src.modules.messaging.hooks.resolve_recipients")
    @patch("src.modules.messaging.hooks.get_active_config")
    def test_emit_dispatches_when_trigger_exists(self, mock_config, mock_recipients, mock_dispatch):
        from src.modules.messaging.hooks import emit_messaging_event

        mock_config.return_value = MagicMock(tenant_id="t1")
        mock_recipients.return_value = ["user@test.com"]

        mock_user = MagicMock()
        mock_user.tenant_id = "t1"

        mock_trigger = MagicMock()
        mock_trigger.id = "trigger-1"
        mock_trigger.subject_template = "Test: {{name}}"
        mock_trigger.body_template = "<p>{{name}}</p>"

        mock_db = MagicMock()
        mock_db.query.return_value.filter.return_value.all.return_value = [mock_trigger]

        mock_bg = MagicMock()

        emit_messaging_event(
            action_key="opportunity.created",
            context={"name": "Opp Test"},
            source_module="oportunidades",
            user=mock_user,
            db=mock_db,
            background_tasks=mock_bg,
        )

        mock_dispatch.assert_called_once()
