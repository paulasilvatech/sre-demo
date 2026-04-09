# Staging Environment - Insecure Configuration
# MISCONFIG: This file contains intentional infrastructure security issues

# MISCONFIG: Hardcoded credentials in tfvars (should use Key Vault / env vars)
environment         = "staging"
resource_group_name = "rg-sre-demo-staging"
location            = "eastus"

# MISCONFIG: Hardcoded database credentials
postgres_admin_username = "admin"
postgres_admin_password = "Staging_P@ssw0rd_2024!"

# MISCONFIG: Weak SKU choices for production-like environment
postgres_sku_name = "B_Standard_B1ms"
redis_sku_name    = "Basic"

alert_email = "admin@company.com"
