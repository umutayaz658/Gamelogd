import urllib.parse
import requests
from django.conf import settings

# --- Steam OpenID ---

def get_steam_openid_url(callback_url):
    """
    Generates the Steam OpenID login URL.
    """
    parsed_url = urllib.parse.urlparse(callback_url)
    realm = f"{parsed_url.scheme}://{parsed_url.netloc}"
    
    params = {
        'openid.ns': 'http://specs.openid.net/auth/2.0',
        'openid.mode': 'checkid_setup',
        'openid.return_to': callback_url,
        'openid.realm': realm,
        'openid.identity': 'http://specs.openid.net/auth/2.0/identifier_select',
        'openid.claimed_id': 'http://specs.openid.net/auth/2.0/identifier_select'
    }
    return f"https://steamcommunity.com/openid/login?{urllib.parse.urlencode(params)}"

def verify_steam_openid_response(query_params):
    """
    Verifies the Steam OpenID response and extracts the Steam ID.
    Returns steam_id if valid, else None.
    """
    # Create the validation dictionary
    validation_args = query_params.copy()
    validation_args['openid.mode'] = 'check_authentication'
    
    # We must send the exact same parameters back to Steam via POST
    response = requests.post('https://steamcommunity.com/openid/login', data=validation_args, timeout=10)
    
    if 'is_valid:true' in response.text:
        # Extract Steam ID from claimed_id
        # Example claimed_id: https://steamcommunity.com/openid/id/76561198012345678
        claimed_id = query_params.get('openid.claimed_id', '')
        if claimed_id.startswith('https://steamcommunity.com/openid/id/'):
            steam_id = claimed_id.split('/')[-1]
            return steam_id
    return None

# --- Xbox OAuth ---

def get_xbox_oauth_url(callback_url):
    """
    Generates the Microsoft OAuth login URL for Xbox Live.
    """
    client_id = getattr(settings, 'MICROSOFT_CLIENT_ID', '')
    if not client_id:
        raise Exception("MICROSOFT_CLIENT_ID is not configured.")
        
    params = {
        'client_id': client_id,
        'response_type': 'code',
        'redirect_uri': callback_url,
        'scope': 'XboxLive.signin offline_access',
        'prompt': 'select_account',
    }
    return f"https://login.live.com/oauth20_authorize.srf?{urllib.parse.urlencode(params)}"

def exchange_microsoft_code(code, callback_url):
    """
    Exchanges the OAuth code for an access token.
    """
    client_id = getattr(settings, 'MICROSOFT_CLIENT_ID', '')
    client_secret = getattr(settings, 'MICROSOFT_CLIENT_SECRET', '')
    
    data = {
        'client_id': client_id,
        'client_secret': client_secret,
        'code': code,
        'grant_type': 'authorization_code',
        'redirect_uri': callback_url
    }
    
    response = requests.post('https://login.live.com/oauth20_token.srf', data=data, timeout=10)
    response.raise_for_status()
    return response.json()['access_token']

def authenticate_with_xbox_live(access_token):
    """
    Authenticates with Xbox Live using the Microsoft access token.
    Returns the user token.
    """
    headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }
    data = {
        "Properties": {
            "AuthMethod": "RPS",
            "SiteName": "user.auth.xboxlive.com",
            "RpsTicket": f"d={access_token}"
        },
        "RelyingParty": "http://auth.xboxlive.com",
        "TokenType": "JWT"
    }
    response = requests.post('https://user.auth.xboxlive.com/user/authenticate', headers=headers, json=data, timeout=10)
    response.raise_for_status()
    return response.json()['Token']

def authorize_with_xsts(user_token):
    """
    Authorizes with XSTS using the Xbox Live user token.
    Returns the XSTS token and user hash.
    """
    headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }
    data = {
        "Properties": {
            "SandboxId": "RETAIL",
            "UserTokens": [user_token]
        },
        "RelyingParty": "http://xboxlive.com",
        "TokenType": "JWT"
    }
    response = requests.post('https://xsts.auth.xboxlive.com/xsts/authorize', headers=headers, json=data, timeout=10)
    response.raise_for_status()
    
    # Extract xsts_token and user_hash
    data = response.json()
    xsts_token = data['Token']
    user_hash = data['DisplayClaims']['xui'][0]['uhs']
    return xsts_token, user_hash

def get_xbox_profile(xsts_token, user_hash):
    """
    Fetches the user's Xbox profile (Gamertag and XUID).
    """
    headers = {
        'x-xbl-contract-version': '2',
        'Authorization': f'XBL3.0 x={user_hash};{xsts_token}',
        'Accept-Language': 'en-US'
    }
    response = requests.get('https://profile.xboxlive.com/users/me/profile/settings?settings=Gamertag', headers=headers, timeout=10)
    response.raise_for_status()
    
    data = response.json()
    user_data = data['profileUsers'][0]
    xuid = user_data['id']
    gamertag = user_data['settings'][0]['value']
    
    return {'xuid': xuid, 'gamertag': gamertag}

def process_xbox_oauth_flow(code, callback_url):
    """
    Executes the entire Xbox Live OAuth flow.
    Returns the user's Xbox Gamertag.
    """
    try:
        # Step 1: Get Microsoft Access Token
        access_token = exchange_microsoft_code(code, callback_url)
        
        # Step 2: Authenticate with Xbox Live
        user_token = authenticate_with_xbox_live(access_token)
        
        # Step 3: Authorize with XSTS
        xsts_token, user_hash = authorize_with_xsts(user_token)
        
        # Step 4: Get Profile Data
        profile_data = get_xbox_profile(xsts_token, user_hash)
        gamertag = profile_data['gamertag']
        xuid = profile_data['xuid']
        
        return gamertag, xuid, xsts_token, user_hash
    except Exception as e:
        print(f"Xbox OAuth Flow Error: {e}")
        return None
