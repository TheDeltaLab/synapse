#!/usr/bin/env bash
set -e

# ============================================
# Synapse Azure Deployment Doctor
# ============================================
# Diagnoses and fixes Azure OIDC configuration
# for GitHub Actions deployments.
# ============================================

VERSION="1.0.0"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Default configuration
APP_NAME="${AZURE_APP_NAME:-synapse-github-actions}"
CREDENTIAL_PREFIX="${AZURE_CREDENTIAL_PREFIX:-github-actions}"
GITHUB_ORG="${GITHUB_ORG:-}"
GITHUB_REPO="${GITHUB_REPO:-synapse}"
ENVIRONMENTS="test staging production"
AUTO_FIX=false
CHECK_ONLY=false
VERBOSE=false

# Function to get resource group for environment (avoids associative arrays for bash 3.x)
get_resource_group() {
    local env="$1"
    case "$env" in
        test) echo "synapse-test-rg" ;;
        staging) echo "synapse-staging-rg" ;;
        production) echo "synapse-rg" ;;
        *) echo "" ;;
    esac
}

# ============================================
# Help and Usage
# ============================================
show_help() {
    echo -e "${BOLD}Synapse Azure Deployment Doctor${NC} v${VERSION}"
    echo ""
    echo "Diagnoses and fixes Azure OIDC configuration for GitHub Actions deployments."
    echo ""
    echo -e "${BOLD}USAGE${NC}"
    echo "    ./scripts/azure-doctor.sh [OPTIONS]"
    echo ""
    echo -e "${BOLD}OPTIONS${NC}"
    echo "    -h, --help              Show this help message and exit"
    echo "    -v, --version           Show version number"
    echo "    -c, --check-only        Run checks without prompting for fixes"
    echo "    -y, --yes, --auto-fix   Automatically apply all fixes without prompting"
    echo "    --verbose               Show detailed output for debugging"
    echo ""
    echo "    --app-name NAME         Azure AD application name (default: synapse-github-actions)"
    echo "    --credential-prefix PFX Federated credential name prefix (default: github-actions)"
    echo "                            Credentials will be named: <prefix>-<env>"
    echo "                            Example: --credential-prefix synapse-github-actions"
    echo "                                     → synapse-github-actions-test"
    echo "                                     → synapse-github-actions-staging"
    echo "                                     → synapse-github-actions-production"
    echo "    --github-org ORG        GitHub organization/username (will prompt if not set)"
    echo "    --github-repo REPO      GitHub repository name (default: synapse)"
    echo "    --env ENV               Check specific environment only (test, staging, production)"
    echo ""
    echo -e "${BOLD}ENVIRONMENT VARIABLES${NC}"
    echo "    AZURE_APP_NAME          Same as --app-name"
    echo "    AZURE_CREDENTIAL_PREFIX Same as --credential-prefix"
    echo "    GITHUB_ORG              Same as --github-org"
    echo "    GITHUB_REPO             Same as --github-repo"
    echo ""
    echo -e "${BOLD}EXAMPLES${NC}"
    echo -e "    ${CYAN}# Interactive mode (recommended for first-time setup)${NC}"
    echo "    ./scripts/azure-doctor.sh"
    echo ""
    echo -e "    ${CYAN}# Check configuration without making changes${NC}"
    echo "    ./scripts/azure-doctor.sh --check-only"
    echo ""
    echo -e "    ${CYAN}# Auto-fix all issues (CI/CD friendly)${NC}"
    echo "    ./scripts/azure-doctor.sh --yes --github-org myorg"
    echo ""
    echo -e "    ${CYAN}# Check specific environment only${NC}"
    echo "    ./scripts/azure-doctor.sh --env production"
    echo ""
    echo -e "    ${CYAN}# Use custom app name and credential prefix${NC}"
    echo "    ./scripts/azure-doctor.sh --app-name alluneed-github --credential-prefix synapse-github-actions"
    echo ""
    echo -e "    ${CYAN}# Set via environment variables${NC}"
    echo "    AZURE_APP_NAME=alluneed-github AZURE_CREDENTIAL_PREFIX=synapse-github-actions ./scripts/azure-doctor.sh"
    echo ""
    echo -e "    ${CYAN}# Check specific environment only${NC}"
    echo "    ./scripts/azure-doctor.sh --env test"
    echo ""
    echo -e "${BOLD}WHAT IT CHECKS${NC}"
    echo "    1. Azure CLI authentication"
    echo "    2. Azure AD application exists"
    echo "    3. Service principal exists"
    echo "    4. Role assignments (Contributor) on resource groups"
    echo "    5. Federated credentials for GitHub OIDC"
    echo ""
    echo -e "${BOLD}RESOURCE GROUPS${NC}"
    echo "    Environment     Resource Group"
    echo "    -----------     --------------"
    echo "    test            synapse-test-rg"
    echo "    staging         synapse-staging-rg"
    echo "    production      synapse-rg"
    echo ""
    echo -e "${BOLD}OUTPUT VALUES${NC}"
    echo "    After running, the script outputs:"
    echo "    - AZURE_CLIENT_ID     → Add as GitHub repository variable"
    echo "    - AZURE_TENANT_ID     → Add as GitHub repository variable"
    echo "    - AZURE_SUBSCRIPTION_ID → Add per GitHub environment"
    echo ""
    echo -e "${BOLD}DOCUMENTATION${NC}"
    echo "    See docs/AZURE_OIDC_SETUP.md for detailed setup instructions."
    echo ""
    echo -e "${BOLD}COMMON ERRORS FIXED${NC}"
    echo "    - \"does not have authorization to perform action\""
    echo "      → Missing Contributor role assignment"
    echo ""
    echo "    - \"AADSTS70021: No matching federated identity record\""
    echo "      → Missing federated credential for environment"
    echo ""
    echo "    - \"The subscription could not be found\""
    echo "      → AZURE_SUBSCRIPTION_ID not set in GitHub environment"
    echo ""
}

show_version() {
    echo "azure-doctor.sh version $VERSION"
}

# ============================================
# Parse Arguments
# ============================================
SPECIFIC_ENV=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--version)
            show_version
            exit 0
            ;;
        -c|--check-only)
            CHECK_ONLY=true
            shift
            ;;
        -y|--yes|--auto-fix)
            AUTO_FIX=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --app-name)
            APP_NAME="$2"
            shift 2
            ;;
        --credential-prefix)
            CREDENTIAL_PREFIX="$2"
            shift 2
            ;;
        --github-org)
            GITHUB_ORG="$2"
            shift 2
            ;;
        --github-repo)
            GITHUB_REPO="$2"
            shift 2
            ;;
        --env)
            SPECIFIC_ENV="$2"
            if [[ ! " test staging production " =~ " ${SPECIFIC_ENV} " ]]; then
                echo -e "${RED}Error: Invalid environment '$SPECIFIC_ENV'${NC}"
                echo "Valid environments: test, staging, production"
                exit 1
            fi
            ENVIRONMENTS="$SPECIFIC_ENV"
            shift 2
            ;;
        *)
            echo -e "${RED}Error: Unknown option '$1'${NC}"
            echo "Run './scripts/azure-doctor.sh --help' for usage"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Synapse Azure Deployment Doctor                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Track issues found
ISSUES_FOUND=0
FIXES_AVAILABLE=0
FIXES_APPLIED=0

# Helper functions
print_check() {
    echo -e "${BLUE}[CHECK]${NC} $1"
}

print_ok() {
    echo -e "${GREEN}[OK]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
}

print_fix() {
    echo -e "${YELLOW}[FIX AVAILABLE]${NC} $1"
    FIXES_AVAILABLE=$((FIXES_AVAILABLE + 1))
}

print_fixed() {
    echo -e "${GREEN}[FIXED]${NC} $1"
    FIXES_APPLIED=$((FIXES_APPLIED + 1))
}

print_verbose() {
    if [ "$VERBOSE" = true ]; then
        echo -e "${CYAN}[DEBUG]${NC} $1"
    fi
}

ask_confirm() {
    local prompt="$1"

    # Check-only mode: never fix
    if [ "$CHECK_ONLY" = true ]; then
        return 1
    fi

    # Auto-fix mode: always fix
    if [ "$AUTO_FIX" = true ]; then
        echo -e "${YELLOW}$prompt${NC} → Auto-applying fix"
        return 0
    fi

    # Interactive mode: ask user (read from terminal explicitly)
    echo -e -n "${YELLOW}$prompt (y/n):${NC} "
    read -r response < /dev/tty
    [[ "$response" =~ ^[Yy]$ ]]
}

# ============================================
# Check 1: Azure CLI Login
# ============================================
echo -e "\n${BLUE}═══ Step 1: Azure CLI Authentication ═══${NC}"
print_check "Checking Azure CLI login status..."

if ! az account show &>/dev/null; then
    print_error "Not logged in to Azure CLI"
    if ask_confirm "Would you like to login now?"; then
        az login
        print_ok "Logged in successfully"
    else
        echo "Please run 'az login' and try again"
        exit 1
    fi
else
    CURRENT_ACCOUNT=$(az account show --query name -o tsv)
    print_ok "Logged in as: $CURRENT_ACCOUNT"
fi

# ============================================
# Check 2: Azure AD Application
# ============================================
echo -e "\n${BLUE}═══ Step 2: Azure AD Application ═══${NC}"
print_check "Looking for Azure AD application '$APP_NAME'..."

APP_ID=$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv 2>/dev/null)

if [ -z "$APP_ID" ]; then
    print_error "Azure AD application '$APP_NAME' not found"
    print_fix "Create Azure AD application"

    if ask_confirm "Would you like to create the application now?"; then
        echo "Creating Azure AD application..."
        APP_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv)
        print_fixed "Created application with ID: $APP_ID"

        echo "Creating service principal..."
        az ad sp create --id "$APP_ID" &>/dev/null
        print_fixed "Created service principal"
    fi
else
    print_ok "Found application: $APP_ID"
fi

# ============================================
# Check 3: Service Principal
# ============================================
echo -e "\n${BLUE}═══ Step 3: Service Principal ═══${NC}"

if [ -n "$APP_ID" ]; then
    print_check "Looking for service principal..."

    SP_OBJECT_ID=$(az ad sp list --filter "appId eq '$APP_ID'" --query "[0].id" -o tsv 2>/dev/null)

    if [ -z "$SP_OBJECT_ID" ]; then
        print_error "Service principal not found for application"
        print_fix "Create service principal"

        if ask_confirm "Would you like to create the service principal now?"; then
            SP_OBJECT_ID=$(az ad sp create --id "$APP_ID" --query id -o tsv)
            print_fixed "Created service principal: $SP_OBJECT_ID"
        fi
    else
        print_ok "Found service principal: $SP_OBJECT_ID"
    fi
fi

# ============================================
# Check 4: Role Assignments
# ============================================
echo -e "\n${BLUE}═══ Step 4: Role Assignments ═══${NC}"

if [ -n "$SP_OBJECT_ID" ]; then
    # Get all subscriptions
    echo ""
    print_check "Checking role assignments across subscriptions..."

    # List available subscriptions
    echo -e "\n${BLUE}Available subscriptions:${NC}"
    az account list --query "[].{Name:name, ID:id, IsDefault:isDefault}" -o table
    echo ""

    for ENV in $ENVIRONMENTS; do
        RG=$(get_resource_group "$ENV")
        echo -e "\n${BLUE}--- Environment: $ENV (Resource Group: $RG) ---${NC}"

        # Ask for subscription if not set
        echo -e "Enter subscription ID/name for '$ENV' environment (or press Enter to skip):"
        read -r SUB_INPUT < /dev/tty

        if [ -z "$SUB_INPUT" ]; then
            print_warn "Skipping $ENV environment"
            continue
        fi

        # Set subscription
        if ! az account set --subscription "$SUB_INPUT" 2>/dev/null; then
            print_error "Invalid subscription: $SUB_INPUT"
            continue
        fi

        SUBSCRIPTION_ID=$(az account show --query id -o tsv)
        SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
        print_ok "Using subscription: $SUBSCRIPTION_NAME ($SUBSCRIPTION_ID)"

        # Check if resource group exists
        print_check "Checking if resource group '$RG' exists..."
        if ! az group show --name "$RG" &>/dev/null; then
            print_warn "Resource group '$RG' does not exist"

            if ask_confirm "Would you like to create it?"; then
                echo "Enter location (e.g., eastus, westeurope):"
                read -r LOCATION < /dev/tty
                az group create --name "$RG" --location "$LOCATION" &>/dev/null
                print_fixed "Created resource group: $RG"
            else
                continue
            fi
        else
            print_ok "Resource group exists: $RG"
        fi

        # Check role assignment on resource group
        print_check "Checking Contributor role on resource group..."

        ROLE_SCOPE="/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RG"
        ROLE_EXISTS=$(az role assignment list \
            --assignee "$SP_OBJECT_ID" \
            --scope "$ROLE_SCOPE" \
            --role "Contributor" \
            --query "[0].id" -o tsv 2>/dev/null)

        if [ -z "$ROLE_EXISTS" ]; then
            print_error "Missing Contributor role on $RG"
            print_fix "Assign Contributor role"

            if ask_confirm "Would you like to assign Contributor role now?"; then
                az role assignment create \
                    --assignee-object-id "$SP_OBJECT_ID" \
                    --assignee-principal-type ServicePrincipal \
                    --role "Contributor" \
                    --scope "$ROLE_SCOPE" &>/dev/null
                print_fixed "Assigned Contributor role on $RG"
            fi
        else
            print_ok "Contributor role assigned on $RG"
        fi

        # Check for Container Apps specific permissions
        print_check "Checking Container Apps permissions..."

        # Try to list Container Apps environments (this is what the error message was about)
        if az containerapp env list --resource-group "$RG" &>/dev/null; then
            print_ok "Container Apps access verified"
        else
            print_warn "Cannot access Container Apps in $RG (may not exist yet, which is OK)"
        fi
    done
fi

# ============================================
# Check 5: Federated Credentials
# ============================================
echo -e "\n${BLUE}═══ Step 5: Federated Credentials (OIDC) ═══${NC}"

if [ -n "$APP_ID" ]; then
    # Get GitHub org if not set
    if [ -z "$GITHUB_ORG" ]; then
        echo "Enter your GitHub organization/username:"
        read -r GITHUB_ORG < /dev/tty
    fi

    print_check "Checking federated credentials for $GITHUB_ORG/$GITHUB_REPO..."
    print_verbose "Using credential prefix: $CREDENTIAL_PREFIX"

    EXISTING_CREDS=$(az ad app federated-credential list --id "$APP_ID" --query "[].name" -o tsv 2>/dev/null)

    # Show all existing credentials
    if [ "$VERBOSE" = true ]; then
        echo -e "  ${CYAN}Existing credentials:${NC}"
        echo "$EXISTING_CREDS" | while read -r cred; do
            echo "    - $cred"
        done
        echo ""
    fi

    for ENV in $ENVIRONMENTS; do
        SUBJECT="repo:$GITHUB_ORG/$GITHUB_REPO:environment:$ENV"

        # Try to find a matching credential by checking subject
        FOUND_CRED=""
        FOUND_SUBJECT=""

        # Check all existing credentials for matching subject
        while IFS= read -r cred_name; do
            [ -z "$cred_name" ] && continue
            cred_subject=$(az ad app federated-credential show --id "$APP_ID" --federated-credential-id "$cred_name" --query "subject" -o tsv 2>/dev/null)
            if [ "$cred_subject" = "$SUBJECT" ]; then
                FOUND_CRED="$cred_name"
                FOUND_SUBJECT="$cred_subject"
                break
            fi
        done <<< "$EXISTING_CREDS"

        if [ -n "$FOUND_CRED" ]; then
            print_ok "Federated credential '$FOUND_CRED' configured for $ENV environment"
            print_verbose "  Subject: $FOUND_SUBJECT"
        else
            # Determine what name to use for new credential
            NEW_CRED_NAME="${CREDENTIAL_PREFIX}-${ENV}"
            print_error "Missing federated credential for $ENV environment"
            print_fix "Create federated credential for $ENV environment"

            # Always show what would be created
            echo ""
            echo -e "  ${BOLD}Credential details:${NC}"
            echo -e "    Name:      ${CYAN}$NEW_CRED_NAME${NC}"
            echo -e "    Issuer:    https://token.actions.githubusercontent.com"
            echo -e "    Subject:   ${CYAN}$SUBJECT${NC}"
            echo -e "    Audiences: api://AzureADTokenExchange"
            echo ""
            echo -e "  ${BOLD}This allows GitHub Actions to authenticate when:${NC}"
            echo -e "    - Repository: ${CYAN}$GITHUB_ORG/$GITHUB_REPO${NC}"
            echo -e "    - Environment: ${CYAN}$ENV${NC}"
            echo ""
            echo -e "  ${BOLD}Verify in Azure Portal:${NC}"
            echo -e "    https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationMenuBlade/~/Credentials/appId/$APP_ID"
            echo ""
            echo -e "  ${BOLD}Verify GitHub Environment exists:${NC}"
            echo -e "    https://github.com/$GITHUB_ORG/$GITHUB_REPO/settings/environments"
            echo ""

            if ask_confirm "Would you like to create federated credential for '$ENV'?"; then
                az ad app federated-credential create \
                    --id "$APP_ID" \
                    --parameters "{
                        \"name\": \"$NEW_CRED_NAME\",
                        \"issuer\": \"https://token.actions.githubusercontent.com\",
                        \"subject\": \"$SUBJECT\",
                        \"audiences\": [\"api://AzureADTokenExchange\"]
                    }" &>/dev/null
                print_fixed "Created federated credential: $NEW_CRED_NAME"
            fi
        fi
    done
fi

# ============================================
# Summary
# ============================================
echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                        Summary                             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Show mode
if [ "$CHECK_ONLY" = true ]; then
    echo -e "${CYAN}Mode: Check only (no fixes applied)${NC}"
elif [ "$AUTO_FIX" = true ]; then
    echo -e "${CYAN}Mode: Auto-fix${NC}"
else
    echo -e "${CYAN}Mode: Interactive${NC}"
fi
echo ""

# Show statistics
echo -e "${BOLD}Results:${NC}"
if [ $ISSUES_FOUND -eq 0 ]; then
    echo -e "  ${GREEN}✅ Issues found:    0${NC}"
else
    echo -e "  ${YELLOW}⚠️  Issues found:    $ISSUES_FOUND${NC}"
fi

if [ $FIXES_APPLIED -gt 0 ]; then
    echo -e "  ${GREEN}🔧 Fixes applied:   $FIXES_APPLIED${NC}"
fi

if [ $FIXES_AVAILABLE -gt 0 ] && [ $FIXES_APPLIED -lt $FIXES_AVAILABLE ]; then
    REMAINING=$((FIXES_AVAILABLE - FIXES_APPLIED))
    echo -e "  ${YELLOW}📋 Fixes remaining: $REMAINING${NC}"
fi
echo ""

if [ -n "$APP_ID" ]; then
    TENANT_ID=$(az account show --query tenantId -o tsv)

    echo -e "${BOLD}Azure Configuration Values:${NC}"
    echo ""
    echo -e "  ${GREEN}AZURE_CLIENT_ID${NC}       $APP_ID"
    echo -e "  ${GREEN}AZURE_TENANT_ID${NC}       $TENANT_ID"
    echo ""
    echo -e "${BOLD}GitHub Setup:${NC}"
    echo ""
    echo "  1. Add repository variables (Settings → Secrets and variables → Actions → Variables):"
    echo -e "     ${CYAN}AZURE_CLIENT_ID${NC}  = $APP_ID"
    echo -e "     ${CYAN}AZURE_TENANT_ID${NC}  = $TENANT_ID"
    echo ""
    echo "  2. For each environment (Settings → Environments → [env] → Add variable):"
    echo -e "     ${CYAN}AZURE_SUBSCRIPTION_ID${NC} = <subscription-id-for-that-env>"
    echo -e "     ${CYAN}GATEWAY_URL${NC}           = https://synapse-gateway-[env].azurecontainerapps.io"
    echo -e "     ${CYAN}DASHBOARD_URL${NC}         = https://synapse-dashboard-[env].azurecontainerapps.io"
fi

echo ""
if [ $ISSUES_FOUND -eq 0 ] || [ $FIXES_APPLIED -eq $ISSUES_FOUND ]; then
    echo -e "${GREEN}✅ Your Azure setup is ready for GitHub Actions deployment!${NC}"
elif [ "$CHECK_ONLY" = true ]; then
    echo -e "${YELLOW}⚠️  Found $ISSUES_FOUND issue(s). Run without --check-only to fix.${NC}"
else
    REMAINING=$((ISSUES_FOUND - FIXES_APPLIED))
    echo -e "${YELLOW}⚠️  $REMAINING issue(s) remaining. Please review above.${NC}"
fi

echo ""
echo -e "${BLUE}Documentation: docs/AZURE_OIDC_SETUP.md${NC}"
echo ""
