import requests
from api.services.igdb_service import get_igdb_token, IGDB_CLIENT_ID

def check():
    token = get_igdb_token()
    headers = {'Client-ID': IGDB_CLIENT_ID, 'Authorization': f'Bearer {token}'}
    res = requests.post(
        'https://api.igdb.com/v4/games', 
        headers=headers, 
        data='fields id, name, category, version_parent, parent_game; search "Grand Theft Auto V"; limit 10;'
    )
    print(res.json())
    
    res2 = requests.post(
        'https://api.igdb.com/v4/games', 
        headers=headers, 
        data='fields id, name, category, version_parent, parent_game; search "The Legend of Zelda: Breath of the Wild"; limit 10;'
    )
    print(res2.json())

check()
