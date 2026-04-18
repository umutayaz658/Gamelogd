import requests

url1 = "https://steamcdn-a.akamaihd.net/steam/apps/400/library_600x900.jpg"
url2 = "https://steamcdn-a.akamaihd.net/steam/apps/400/header.jpg"

r1 = requests.get(url1)
print(f"URL1: {r1.status_code}")

r2 = requests.get(url2)
print(f"URL2: {r2.status_code}")

url3 = "https://cdn.cloudflare.steamstatic.com/steam/apps/400/header.jpg"
r3 = requests.get(url3)
print(f"URL3: {r3.status_code}")
