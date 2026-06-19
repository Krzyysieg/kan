# Star Wars RTS — Koncept Gry

## Podstawowe informacje

- **Gatunek gry:** Strategiczna RTS
- **Świat gry:** Star Wars
- **Inspiracja konceptem:** Władca Pierścieni: Bitwa o Śródziemie II
- **Silnik gry:** Unity 6.4 (6000.4.9f1) `<DX12>`
- **Unity HUB:** 3.18.0
- **Kontrola kodu:** GIT, GitHub Desktop
- **AI w kodowaniu:** Claude Desktop (Windows 11)
- **Multiplayer:** LAN
- **Kompilator:** Microsoft Visual Studio 2026 (maj)
- **Język programowania:** C#

## Ogólna wizja

Gra ma być grą strategiczną **RTS**, osadzoną w świecie **Star Wars** w czasach od Republiki i CIS po Rebelię i Imperium. Mechaniki i styl gry mają być takie jak w **Władca Pierścieni: Bitwa o Śródziemie II**.

### Tryby rozgrywki

- **Kampania** — osobna dla każdej z frakcji
- **Rywalizacja LAN** — gracz vs gracz (PvP)
- **Gra lokalna** — gracz vs SI
- **LAN mieszane** — gracz vs gracz vs SI

### Cel rozgrywki

Głównym celem gry jest **eliminacja wszystkich przeciwników**.

### Zgodność z uniwersum

Gra ma być całkowicie zgodna z **LORE Star Wars** — dotyczy to także klimatu gry oraz UI.

## Pakiety Unity

- Universal RP (URP)
- Input System
- AI Navigation
- Cinemachine
- TextMeshPro
- Mirror Networking
- DOTween (HOTween v2)

## Frakcje

Frakcje występujące w grze dzielą się na **dobre**, **złe** i **neutralne**.

Frakcji neutralnych **nie można wybrać** — występują one na dedykowanej dla danej frakcji mapie, zgodnej z LORE Star Wars. Dla każdej frakcji na danej mapie będą pojedyncze, dedykowane budynki do ich rekrutacji. Każdy gracz będzie mógł je **przejąć** i zacząć produkować w nich jednostki.

### Dobre

- Republika
- Rebelia

### Złe

- CIS (Separatyści)
- Imperium

### Neutralne

- Gungan Grand Army
- Mon Cala Planetary Defense Forces / Mon Calamari
- Hutt Clan
- Pantoranie
- Wookiee
- Coruscant Guard
- Senate Guard
- Geonosianie
- Umbaran Militia
- Zygerrian Slave Empire
- Death Watch
- Inquisitorius

## Jednostki — CIS (Separatyści)

### Piechota (głównie droidy)

- **B1 Battle Droids** — podstawowa, masowa piechota.
- **B2 Super Battle Droids** — cięższa, lepiej opancerzona wersja.
- **BX Commando Droids** — elitarne; sabotaż i infiltracja.
- **Droidekas (Destroyer Droids)** — z tarczami.
- **Magnaguards (IG-100)** — elita ochroniarzy Grievousa.

### Jednostki zmechanizowane

- **AAT (Armored Assault Tank)** — główny czołg.
- **MTT (Multi-Troop Transport)** — duży transporter droidów.
- **Hailfire Droid (IG-227)** — rakietowy.
- **Dwarf Spider Droid / Octuptarra Droid**
- **Persuader-class Tank Droid** — z gąsienicami.
- **C-9979 Landing Craft** — desantowiec.
- **Umbaran Hover Tanks i Mobile Cannons** — z serialu.

### Jednostki latające

- **Vulture Droid** (droid starfighter) — masowy myśliwiec.
- **Tri-Fighter** (droid starfighter).
- **Hyena-class Bomber** (droid bomber).
- **Droid Gunship (HMP)**
- **Belbullab-22** — np. Grievousa.
- **Munificent-class Frigate, Providence-class, Lucrehulk** — jako carrier.

### Jednostki budowniczych

> Dedykowane jednostki budowniczych.

---

**Uwaga:** Każdy rodzaj jednostki ma mieć swój wariant kamuflażu opancerzenia zależny od klimatu mapy: **klasyczny**, **zimowy**, **pustynny**, **dżungla**.

## Budynki

Każda frakcja ma mieć własne **unikalne budynki** oraz unikalny **kamuflaż** pasujący do klimatu mapy (klasyczny, pustynia, zima, dżungla), ale tej samej kategorii.

### Kategorie budynków

- **Siedziba główna** — główny budynek, baza startowa.
- **Budynek wydobywczy** — 3 oddzielne budynki, po jednym dla każdego surowca:
  - Durasteel
  - Advanced Components
  - Tibanna Gas
- **Koszary piechoty** — rekrutuje oddział złożony z **5 żołnierzy** danego typu.
- **Fabryka pojazdów zmechanizowanych** — rekrutuje **pojedynczą jednostkę**.
- **Hangar jednostek latających** — rekrutuje **pojedynczą jednostkę**.
- **Budynek jednostek specjalnych** — rekrutuje **pojedynczą jednostkę**.
- **Centrum badań technologii** — odblokowuje drzewko technologii.
- **Elektrownia** — wytwarza energię.
- **Baraki mieszkalne** — powiększają **force limit** jednostek.
- **Centrum badań budowli obronnych** — odblokowuje ulepszenia obrony.

## Surowce

Surowce są wspólne dla wszystkich frakcji.

### 1. Durasteel *(Metal / Alloys)*

Podstawowy surowiec do budowy wszystkich budynków i pancerza jednostek.

- Wydobywany z kopalń na planetach (np. asteroidy, planety górnicze jak Mygeeto, Lothal).
- Najbardziej uniwersalny i najłatwiej dostępny.
- Wydobywany: **x/min**

### 2. Advanced Components *(Kyberite / Rare Materials)*

Zaawansowany surowiec do elitarnych jednostek (Rycerze Jedi, jednostki specjalne), superbroni i budynków specjalnych.

- Rzadki — pojawia się na specjalnych polach mapy; gracze muszą o niego rywalizować.
- Wydobywany: **x/min**

### 3. Tibanna Gas *(Hyperfuel / Energia)*

Zużywany do produkcji jednostek latających, dział, tarcz i generatorów energii.

- Wydobywany z gazowych gigantów (np. Bespin) lub rafinerii.
- Łatwo dostępny w okolicach bazy gracza.
- Kluczowy dla późniejszej gry (tech tree).
- Wydobywany: **x/min**

### 4. Credits *(waluta galaktyczna)*

Służy do szybkiego zakupu armii, budynków oraz handlu.

- Generowany bazowo: **x/min**
- Ulepszany przez unikalne dla każdej frakcji budynki specjalne (np. Spaceport, Mining Guild Outpost): **+x/min**

### 5. Energia

Utrzymuje produkcję budynków, jednostek i obrony.
