# Interfaccia di Prenotazione Appuntamenti

Questa è un'interfaccia di prenotazione appuntamenti mobile-friendly che si integra con GoHighLevel CRM. L'applicazione permette agli utenti di selezionare la loro preferenza di orario (mattina o pomeriggio), visualizzare i giorni disponibili e scegliere uno slot di tempo per prenotare un appuntamento.

## Caratteristiche

- Interfaccia responsive e mobile-friendly
- Flusso di prenotazione semplificato in 4 passaggi:
  1. Selezione della preferenza (mattina/pomeriggio)
  2. Visualizzazione e selezione delle date e degli orari disponibili
  3. Inserimento dei dati di contatto
  4. Conferma della prenotazione
- Visualizza slot disponibili tra due giornate diverse
- Integrazione con GoHighLevel CRM per la gestione degli appuntamenti
- Design moderno e facile da usare

## Configurazione

La configurazione è definita nel file `script.js` nella variabile `CONFIG`:

```javascript
const CONFIG = {
    calendarId: 'MyZldzj3ZYtwz5gjQW6D',
    locationId: 's5MRQQ7j3TjZXRe0CtvE',
    apiKey: 'YOUR_API_KEY',
    apiEndpoint: 'https://rest.gohighlevel.com/v1/appointments/',
    meetingInterval: 30,
    meetingDuration: 25,
    dateRange: 3,
    maxBookingsPerSlot: 1
};
```

## Come utilizzare

1. Aprire il file `index.html` in un browser web
2. Selezionare la preferenza tra mattina o pomeriggio
3. Scegliere una data e un orario disponibile
4. Inserire i propri dati di contatto
5. Confermare la prenotazione

## Integrazione con GoHighLevel

L'applicazione è predisposta per l'integrazione con l'API di GoHighLevel. Per attivare l'integrazione:

1. Assicurarsi che i parametri di configurazione siano corretti (`calendarId`, `locationId`, `apiKey`)
2. Togliere il commento al codice dell'API call nella funzione `showConfirmation` in `script.js`

## Personalizzazione

È possibile personalizzare l'aspetto dell'interfaccia modificando il file `styles.css`. I colori principali sono definiti nel selettore `:root`:

```css
:root {
    --primary-color: #4a6fff;
    --primary-hover: #3a5fee;
    --secondary-color: #f5f7ff;
    --text-color: #333;
    --light-text: #777;
    --border-color: #ddd;
    --success-color: #4caf50;
    --morning-color: #ffb74d;
    --afternoon-color: #64b5f6;
}
```

## Struttura dei file

- `index.html` - Struttura HTML dell'interfaccia
- `styles.css` - Stili CSS per l'interfaccia
- `script.js` - Logica JavaScript e interazione con l'API 