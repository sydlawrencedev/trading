Trading

Backtesting and trading on alpaca

## Keys

You will need to copy ./.keys.example.js and create a new file ./.keys.js

## Try it out

You need Node.js installed to run this.

Clone or download the repo.

Change to repo's directory and install dependencies:
****
    npm install

Now run it:

    node index.js

This will backtest a trading strategy across a whole range of stocks and shares.

settings.js

You can choose which stocks you want to track, as well as which strategy you want to use.

## Strategies

Look in the ./strategies directory for a range of strategies, you can pick which one you want to go with in the settings file

## Alpaca trading

node trade.js

This will run through your trading strategy with all of the stocks you've added, if it finds any trades it needs to make, it currently confirms that with you as the owner.
