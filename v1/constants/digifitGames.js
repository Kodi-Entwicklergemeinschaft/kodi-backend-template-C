// Game data for different levels
const gameData = {
    level1: {
        words: ['Biene'],
        sentences: [`dniW mi neznat rettälB eleiV. eztaK enie tztis muaB med nebeN netraG ned hcrud tgeilf eneiB enielk eniE .tetfud emulB eid dnu tniehcs ennoS eiD`]
    },
    level2: {
        words: ['See', 'Musik', 'Ufer', 'Kusel', 'Lichtenberg'],
        sentences: [`.laT sad rebü grebnethciL gruB eid tgar enreF red nI .nehcsuatsua nethcihcseG dnu etkudorP elanoiger nehcsneM ow ,ztalptkraM mov kisuM tgnilk gatsmaS nedeJ .emuäbtsbO etla dnu ehcsüblednevaL neshcaw nebenad ,suahkrewhcaF nie thets refU mA .tlegeips lemmiH red hcis med ni ,eeS renielk nie tgeil lesuK nov nlegüH ned nehcsiwZ`]
    },
    level3: {
        words: ['see', 'musik', 'ufer', 'kusel', 'lichtenberg'],
        sentences: [`zwischendenhügelnvonkusel\nliegteinkleinerseeindemsichder\nhimmelspiegelt
            amufersstehtein\nfachwerkhausdanebenwachsen\nlavendelbüscheundalteobstbäum\n
            ejedensamstagklingtmusik\nvommarktplatzwomenschen\nregionaleprodukteundges
            chi\nchtenaustauscheninderfernerag\ntdieburglichtenbergüberdastal.`]
    }
};

const pictureUrls = [
    'admin/games/picturegame/Abteikirche-Offenbach.jpg',
    'admin/games/picturegame/Abteikirche-Offenbach-1.jpg',
    'admin/games/picturegame/Burg-Lichtenberg.jpg',
    'admin/games/picturegame/Burg-Lichtenberg-nacht.jpg',
    'admin/games/picturegame/Flurskapelle.jpg',
    'admin/games/picturegame/Haus-nussbach.jpg',
    'admin/games/picturegame/KleineKapelleBrücken.jpg',
    'admin/games/picturegame/Ölmühle-St-Julian.jpg',
    'admin/games/picturegame/Potzberg.jpg',
    'admin/games/picturegame/Rathaus-Kusel.jpg',
    'admin/games/picturegame/Schönenberger-BierkellerII©ManuelBecker.jpg',
    'admin/games/picturegame/St.-Ägidius-Kirche.jpg',
    'admin/games/picturegame/Talbrücke-über-Quirnbach.jpg',
    'admin/games/picturegame/Waldmohr_Rathaus.jpg',
    'admin/games/picturegame/Wartturm.jpg',
    'admin/games/picturegame/Wasserburg_Reipoltskirchen.jpg'
]

const pictureLevel1 = [
    {
        id: 1,
        image1: 'admin/games/picturegame/Abteikirche-Offenbach.jpg',
    },
    {
        id: 2,
        image1: 'admin/games/picturegame/Wasserburg_Reipoltskirchen.jpg'
    },
    {
        id: 3,
        image1: 'admin/games/picturegame/Schönenberger-BierkellerII©ManuelBecker.jpg',
    },
    {
        id: 4,
        image1: 'admin/games/picturegame/Rathaus-Kusel.jpg'
    },
    {
        id: 5,
        image1: 'admin/games/picturegame/Potzberg.jpg',
    },
    {
        id: 6,
        image1: 'admin/games/picturegame/Ölmühle-St-Julian.jpg'
    },
    {
        id: 1,
        image1: 'admin/games/picturegame/Abteikirche-Offenbach.jpg',
    },
    {
        id: 6,
        image1: 'admin/games/picturegame/Ölmühle-St-Julian.jpg'
    },
    {
        id: 2,
        image1: 'admin/games/picturegame/Wasserburg_Reipoltskirchen.jpg'
    },
    {
        id: 5,
        image1: 'admin/games/picturegame/Potzberg.jpg',
    },
    {
        id: 4,
        image1: 'admin/games/picturegame/Rathaus-Kusel.jpg'
    },
    {
        id: 3,
        image1: 'admin/games/picturegame/Schönenberger-BierkellerII©ManuelBecker.jpg',
    }
]

const gamesDescription = {
    1: {
        1: `<p><strong>Wie funktioniert's?</strong></p>

<p style="margin-top: 12px;">
    In der Mitte eines Spielfelds sitzt <strong>Boldi</strong>. 
    Du musst dir merken, wohin er geht!
</p>

<p style="margin-top: 12px;">
    🔁 <strong>Boldi verschwindet</strong> – und du bekommst eine Reihe von Hinweisen:<br>
    <span style="display: inline-block; margin-top: 4px;">z. B. 👉 ➡ ⬇ ⬅ ⬅ ⬆</span>
</p>

<p style="margin-top: 12px;">
    👆 Danach tippst du auf das Feld, wo Boldi jetzt ist.
</p>

<p style="margin-top: 12px;">
    <strong>Je mehr Wege du dir merken kannst, desto besser!</strong>
</p>
`,
        2: `<p><strong>Wie funktioniert's?</strong></p>

<p style="margin-top: 12px;">
    In der Mitte eines Spielfelds sitzt <strong>Boldi</strong>. 
    Du musst dir merken, wohin er geht!
</p>

<p style="margin-top: 12px;">
    🔁 <strong>Boldi verschwindet</strong> – und du bekommst eine Reihe von Hinweisen:<br>
    <span style="display: inline-block; margin-top: 4px;">z. B. 👉 ➡ ⬇ ⬅ ⬅ ⬆</span>
</p>

<p style="margin-top: 12px;">
    👆 Danach tippst du auf das Feld, wo Boldi jetzt ist.
</p>

<p style="margin-top: 12px;">
    <strong>Je mehr Wege du dir merken kannst, desto besser!</strong>
</p>
`,
        3: `<p><strong>Wie funktioniert's?</strong></p>

<p style="margin-top: 12px;">
    In der Mitte eines Spielfelds sitzt <strong>Boldi</strong>. 
    Du musst dir merken, wohin er geht!
</p>

<p style="margin-top: 12px;">
    🔁 <strong>Boldi verschwindet</strong> – und du bekommst eine Reihe von Hinweisen:<br>
    <span style="display: inline-block; margin-top: 4px;">z. B. 👉 ➡ ⬇ ⬅ ⬅ ⬆</span>
</p>

<p style="margin-top: 12px;">
    👆 Danach tippst du auf das Feld, wo Boldi jetzt ist.
</p>

<p style="margin-top: 12px;">
    <strong>Je mehr Wege du dir merken kannst, desto besser!</strong>
</p>
`
    },

    2: {
        4: `<p><strong>Wie funktioniert's?</strong></p>

<p>
    Ein Wort wird dir kurz gezeigt - z. B. „Biene“.
</p>

<p>
    Dann verschwindet es.
</p>

<p>
    Jetzt siehst du einen Text - spiegelverkehrt!
</p>

<p>
    👉 <strong>Deine Aufgabe: Finde das Wort so schnell wie möglich im Bild!</strong>
</p>

<br>

<p><strong>Ebene 1:</strong> Kurze gespiegelte Sätze (z. B. „dniW mi neznat rettälB eleiV.“)</p>`,
        5: `<p><strong>Wie funktioniert's?</strong></p>

<p>
    Ein Wort wird dir kurz gezeigt - z. B. „Biene“.
</p>

<p>
    Dann verschwindet es.
</p>

<p>
    Jetzt siehst du einen Text - spiegelverkehrt!
</p>

<p>
    👉 <strong>Deine Aufgabe: Finde das Wort so schnell wie möglich im Bild!</strong>
</p>

<br>

<p><strong>Ebene 2:</strong> Mehrere Wörter (mit Bezug zum Landkreis Kusel) müssen auswendig gelernt und später in genau derselben Reihenfolge im gespiegelten Textbild wiedergefunden werden.</p>`,
        6: `<p><strong>Wie funktioniert's?</strong></p>

<p>
    Ein Wort wird dir kurz gezeigt - z. B. „Biene“.
</p>

<p>
    Dann verschwindet es.
</p>

<p>
    Jetzt siehst du einen Text – spiegelverkehrt!
</p>

<p>
    👉 <strong>Deine Aufgabe: Finde das Wort so schnell wie möglich im Bild!</strong>
</p>

<br>

<p><strong>Ebene 3:</strong>Mehrere Wörter (mit Bezug zum Landkreis Kusel) müssen auswendig gelernt und später in genau derselben Reihenfolge im gespiegelten Textbild wiedergefunden werden. <strong>Keine Leerzeichen (z. B. „wulkanvulkankiegevasevampirvasevaterwasewiegewampeervulkan“)</strong></p>`,
    },

    3: {
        7: `<p><strong>Wie funktioniert's?</strong></p>

<p>
    Achtung, hier ist dein Rechenkopf gefragt!
</p>

<p>
    Auf dem Bildschirm erscheinen nacheinander kleine Matheaufgaben.
</p>

<p><strong>
    Du siehst jede Zahl und jedes Zeichen nur kurz – du musst im Kopf mitrechnen!
</strong></p>

<p>
    Am Ende bekommst du mehrere mögliche Lösungen angezeigt. 👉 Tippe auf die Zahl, die das richtige Ergebnis ist!
</p>

<br>

<p><strong>Ebene 1:</strong> Zum Beispiel: 5 + 7 – 3 + 6 + 2</p>`,
        8: `<p><strong>Wie funktioniert's?</strong></p>

<p>
    Achtung, hier ist dein Rechenkopf gefragt!
</p>

<p>
    Auf dem Bildschirm erscheinen nacheinander kleine Matheaufgaben.
</p>

<p><strong>
    Du siehst jede Zahl und jedes Zeichen nur kurz – du musst im Kopf mitrechnen!
</strong></p>

<p>
    Am Ende bekommst du mehrere mögliche Lösungen angezeigt. 👉 Tippe auf die Zahl, die das richtige Ergebnis ist!
</p>

<br>

<p><strong>Ebene 2:</strong> 
    Zu jedem Zwischenergebnis musst du zusätzlich 2 dazuzählen.<br>
    Beispiel: Startzahl 5 → +7 = 12 → +2 = 14 → –3 = 11 → +2 = 13 usw.
</p>`,
        9: `<p><strong>Wie funktioniert's?</strong></p>

<p>
    Achtung, hier ist dein Rechenkopf gefragt!
</p>

<p>
    Auf dem Bildschirm erscheinen nacheinander kleine Matheaufgaben.
</p>

<p><strong>
    Du siehst jede Zahl und jedes Zeichen nur kurz – du musst im Kopf mitrechnen!
</strong></p>

<p>
    Am Ende bekommst du mehrere mögliche Lösungen angezeigt. 👉 Tippe auf die Zahl, die das richtige Ergebnis ist!
</p>

<br>

<p><strong>Ebene 3:</strong> Weniger Zeit, um die Aufgaben zu lösen</p>`,
    },

    4: {
        10: `<p><strong>Wie funktioniert's?</strong></p>

<p>
    Auf dem Bildschirm erscheinen viele Zahlen, die bunt gemischt, unterschiedlich groß 
    und chaotisch verteilt sind.
</p>

<p><strong>
    Deine Aufgabe: Finde innerhalb von 1 Minute so viele Zahlen wie möglich - 
    in der richtigen Reihenfolge!
</strong></p>

<p>
    🔢 Du bekommst vor jedem Durchgang eine Startzahl, z. B. „Beginne bei 3“. 
    Von dort aus suchst du weiter: 4, 5, 6 ... so weit du kommst - und das möglichst schnell!
</p>

<p><strong>
    🎯 Ziel ist es, konzentriert zu bleiben, Unterschiede schnell zu erkennen 
    und die Zahlen in der richtigen Reihenfolge anzuklicken.</strong>
</p>

<br>

<p><strong>Ebene 1:</strong> Raster 5x5</p>`,
        11: `<p><strong>Wie funktioniert's?</strong></p>

<p>
    Auf dem Bildschirm erscheinen viele Zahlen, die bunt gemischt, unterschiedlich groß 
    und chaotisch verteilt sind.
</p>

<p><strong>
    Deine Aufgabe: Finde innerhalb von 1 Minute so viele Zahlen wie möglich - 
    in der richtigen Reihenfolge!
    </strong>
</p>

<p>
    🔢 Du bekommst vor jedem Durchgang eine Startzahl, z. B. „Beginne bei 3“. 
    Von dort aus suchst du weiter: 4, 5, 6 ... so weit du kommst - und das möglichst schnell!
</p>

<p><strong>
    🎯 Ziel ist es, konzentriert zu bleiben, Unterschiede schnell zu erkennen 
    und die Zahlen in der richtigen Reihenfolge anzuklicken.</strong>
</p>

<br>

<p>
    <strong>Ebene 2:</strong> Zwei Farbwelten in größerem Feld - gerade Zahlen z. B. in Rot 
    und ungerade Zahlen in Blau (es gibt die Zahlen aber jeweils auch in der anderen Farbe).
</p>`,
        12: `<p><strong>Wie funktioniert's?</strong></p>

<p>
    Auf dem Bildschirm erscheinen viele Zahlen, die bunt gemischt, unterschiedlich groß 
    und chaotisch verteilt sind.
</p>

<p><strong>
    Deine Aufgabe: Finde innerhalb von 1 Minute so viele Zahlen wie möglich - 
    in der richtigen Reihenfolge!
    </strong>
</p>

<p>
    🔢 Du bekommst vor jedem Durchgang eine Startzahl, z. B. „Beginne bei 3“. 
    Von dort aus suchst du weiter: 4, 5, 6 ... so weit du kommst - und das möglichst schnell!
</p>

<p><strong>
    🎯 Ziel ist es, konzentriert zu bleiben, Unterschiede schnell zu erkennen 
    und die Zahlen in der richtigen Reihenfolge anzuklicken.
    </strong>
</p>

<br>

<p>
    <strong>Ebene 3:</strong> Verbotene Zahlen - es gibt Zahlen, die vorher als „verboten“ 
    genannt werden und nicht angetippt werden dürfen.
</p>`,
    },

    5: {
        13: `<p><strong>Wie funktioniert's?</strong></p>

<p>
    Auf dem Bildschirm siehst du 10 Bildpaare, z. B. Zahnbürste & Tomate, 
    Löwe & Blume, Topf & Ball.
</p>

<p>
    🕒 Du hast 45 Sekunden Zeit, dir die Paare gut einzuprägen.
</p>

<p><strong>
    Dann werden einige Bilder vertauscht - und du sollst die ursprünglichen Paare 
    wieder richtig zusammensetzen.
    </strong>
</p>

<p>
    🔍 Merke dir nicht nur die Bilder - sondern auch, wo sie waren!
</p>

<br>

<p><strong>Ebene 1:</strong> Teilweise mit Bildern vom Landkreis Kusel</p>`,
        14: `<p><strong>Wie funktioniert's?</strong></p>

<p>
    Auf dem Bildschirm siehst du 10 Bildpaare, z. B. Zahnbürste & Tomate, 
    Löwe & Blume, Topf & Ball.
</p>

<p>
    🕒 Du hast 45 Sekunden Zeit, dir die Paare gut einzuprägen.
</p>

<p><strong>
    Dann werden einige Bilder vertauscht - und du sollst die ursprünglichen Paare 
    wieder richtig zusammensetzen.
    </strong>
</p>

<p>
    🔍 Merke dir nicht nur die Bilder - sondern auch, wo sie waren!
</p>

<br>

<p>
    <strong>Ebene 2:</strong> Du bekommst nacheinander 15 Bildpaare gezeigt - immer zwei gleichzeitig.<br>
    Nach der Merkrunde werden dir wieder Bildpaare gezeigt - aber nicht alle sind richtig!<br>
    👉 Entscheide bei jedem Paar, ob es korrekt ist.<br>
    ✅ „Korrekt“ oder ❌ „Falsch“.
</p>`,
        15: `<p><strong>Wie funktioniert's?</strong></p>

<p>
    Auf dem Bildschirm siehst du 10 Bildpaare, z. B. Zahnbürste & Tomate, 
    Löwe & Blume, Topf & Ball.
</p>

<p>
    🕒 Du hast 45 Sekunden Zeit, dir die Paare gut einzuprägen.
</p>

<p><strong>
    Dann werden einige Bilder vertauscht - und du sollst die ursprünglichen Paare 
    wieder richtig zusammensetzen.
    </strong>
</p>

<p>
    🔍 Merke dir nicht nur die Bilder - sondern auch, wo sie waren!
</p>

<br>

<p>
    <strong>Ebene 3:</strong> Du siehst alle Bilder durcheinander – aber ein Bild fehlt!<br>
    👉 Finde heraus, welches Bild verschwunden ist (per Eingabe oder Auswahl).
</p>`,
    }
}

module.exports = { gameData, pictureUrls, pictureLevel1, gamesDescription };