# Additional Infrastructure - Staging Networking and Storage
# MISCONFIG: Contains intentional security misconfigurations

# MISCONFIG: Network Security Group with overly permissive rules
resource "azurerm_network_security_group" "staging" {
  name                = "nsg-${var.project_name}-staging"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name

  # MISCONFIG: Allow ALL inbound traffic from anywhere
  security_rule {
    name                       = "AllowAllInbound"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "*"
    source_address_prefix      = "*"      # MISCONFIG: Open to the world
    destination_address_prefix = "*"
  }

  # MISCONFIG: Allow SSH from anywhere
  security_rule {
    name                       = "AllowSSH"
    priority                   = 200
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = "0.0.0.0/0"  # MISCONFIG: SSH open to internet
    destination_address_prefix = "*"
  }

  # MISCONFIG: Allow RDP from anywhere
  security_rule {
    name                       = "AllowRDP"
    priority                   = 300
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "3389"
    source_address_prefix      = "0.0.0.0/0"  # MISCONFIG: RDP open to internet
    destination_address_prefix = "*"
  }

  # MISCONFIG: Allow all database ports from anywhere
  security_rule {
    name                       = "AllowDatabase"
    priority                   = 400
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "5432"
    source_address_prefix      = "0.0.0.0/0"  # MISCONFIG: DB open to internet
    destination_address_prefix = "*"
  }

  tags = local.common_tags
}

# MISCONFIG: Storage account with no security controls
resource "azurerm_storage_account" "staging" {
  name                     = "stgsredemo${random_string.suffix.result}"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"  # MISCONFIG: No geo-redundancy

  # MISCONFIG: Public blob access enabled
  allow_nested_items_to_be_public = true

  # MISCONFIG: HTTP traffic allowed (not HTTPS only)
  enable_https_traffic_only = false

  # MISCONFIG: No minimum TLS version specified (defaults to TLS 1.0)
  min_tls_version = "TLS1_0"

  # MISCONFIG: Shared key access enabled (should use Azure AD)
  shared_access_key_enabled = true

  # MISCONFIG: No blob versioning, soft delete, or lifecycle management
  # Missing: blob_properties with versioning, delete_retention_policy

  # MISCONFIG: No network rules - accessible from all networks
  # Missing: network_rules block

  # MISCONFIG: No encryption scope or customer-managed keys

  tags = local.common_tags
}

# MISCONFIG: Public container with anonymous access
resource "azurerm_storage_container" "uploads" {
  name                  = "uploads"
  storage_account_id    = azurerm_storage_account.staging.id
  container_access_type = "blob"  # MISCONFIG: Public blob access
}

# MISCONFIG: Another public container
resource "azurerm_storage_container" "backups" {
  name                  = "backups"
  storage_account_id    = azurerm_storage_account.staging.id
  container_access_type = "container"  # MISCONFIG: Full public container access
}

# MISCONFIG: Key Vault with no access policies or RBAC
resource "azurerm_key_vault" "staging" {
  name                       = "kv-sre-${random_string.suffix.result}"
  location                   = azurerm_resource_group.main.location
  resource_group_name        = azurerm_resource_group.main.name
  tenant_id                  = data.azurerm_client_config.current.tenant_id
  sku_name                   = "standard"

  # MISCONFIG: Soft delete disabled (data loss risk)
  soft_delete_retention_days = 7

  # MISCONFIG: Purge protection disabled
  purge_protection_enabled   = false

  # MISCONFIG: Public network access enabled
  public_network_access_enabled = true

  # MISCONFIG: No network ACLs
  network_acls {
    default_action = "Allow"  # MISCONFIG: Allow all traffic
    bypass         = "None"   # MISCONFIG: Not even Azure services can bypass
  }

  tags = local.common_tags
}

# MISCONFIG: Storing plaintext secrets in Key Vault (from hardcoded values)
resource "azurerm_key_vault_secret" "db_password" {
  name         = "db-admin-password"
  value        = "Staging_P@ssw0rd_2024!"  # MISCONFIG: Hardcoded secret value
  key_vault_id = azurerm_key_vault.staging.id
}

resource "azurerm_key_vault_secret" "api_key" {
  name         = "api-master-key"
  value        = "master-api-key-hardcoded-in-terraform"  # MISCONFIG: Hardcoded
  key_vault_id = azurerm_key_vault.staging.id
}

# MISCONFIG: PostgreSQL firewall rule allowing all IPs
resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_all" {
  name             = "AllowAllIPs"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"     # MISCONFIG: All IPs
  end_ip_address   = "255.255.255.255"
}

# MISCONFIG: Redis with no authentication or SSL
resource "azurerm_redis_cache" "staging" {
  name                = "redis-sre-staging-${random_string.suffix.result}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  capacity            = 0
  family              = "C"
  sku_name            = "Basic"

  # MISCONFIG: SSL disabled
  enable_non_ssl_port = true

  # MISCONFIG: Minimum TLS version not set (allows TLS 1.0)
  minimum_tls_version = "1.0"

  redis_configuration {
    # MISCONFIG: No maxmemory policy
  }

  # MISCONFIG: No private endpoint, public access
  public_network_access_enabled = true

  tags = local.common_tags
}

# Data source for current Azure config
data "azurerm_client_config" "current" {}

# MISCONFIG: Output sensitive values
output "staging_db_password" {
  value     = "Staging_P@ssw0rd_2024!"  # MISCONFIG: Hardcoded secret in output
  sensitive = false                      # MISCONFIG: Not marked as sensitive
}

output "staging_storage_key" {
  value     = azurerm_storage_account.staging.primary_access_key
  sensitive = false  # MISCONFIG: Access key exposed in outputs
}

output "staging_redis_key" {
  value     = azurerm_redis_cache.staging.primary_access_key
  sensitive = false  # MISCONFIG: Redis key exposed
}
