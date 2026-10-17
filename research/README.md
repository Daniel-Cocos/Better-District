# Southampton consultation aggregation

Run from this directory using Nix with flakes enabled:

```sh
make data
```

## Data Sources

### s77446_carparks

- This document contains hundreds of public representations submitted during Traffic representations Order consultation to introduce parking charges across previously free.
- The council introduced the tariffs to fund car park maintenance and encourage public transport using the breeze app
- Later this course of action was reversed because of the exact issues pointed out in this document

### psg29_portswood_log

- The council got £3 million from the government to make Portswood Broadway (a busy shopping street) greener by banning regular cars from driving straight through parts of the high street
- This file contains two things
  - Specific worry or idea from a resident (e.g., "If cars are forced to turn left at St Denys Road, they might cut across cyclists going straight").
  - What the council engineers did about it (e.g., "Good point—we will paint giant bike symbols across that junction so drivers look for cyclists").
- This means every single row in this database is a True positive constructive feedback sample

### s50527_licensing

- A community venue called the Persian Cultural Centre applied for a licence to play music and serve alcohol late at night.
- In the document there are emails that neighbours wrote with complaints about the venue, alongside legal brief from council lawyers explaining which objections are legally valid
- Ground truth can be extracted from this as actionable legal complaints, however some non-valid legal complaints which would be categorised as "productive" would be marked as false in this version of the ground truth
- No false positives in ground truth, 100% accuracy maybe questionable recall against all real productive complaints

### s69290_budget

- The council proposed raising Council Tax and charging double or triple tax on houses left sitting empty.
- The document contains verbatim public comments mixed with an officer summary
- This is a addition, it can show whether a filter tuned on road/parking comments still works when the topic switches to money and taxes

### s57570_pna

- The council asked residents and health workers if there are enough local pharmacies and if their opening hours work.
- A small table of 21 responses paired with the council's reply
