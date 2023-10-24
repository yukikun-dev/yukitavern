# YukiTavern

## How to Run

### Windows

Double-click `start.bat`

### Linux

```sh
./start.sh
```

### Manual

```sh
# Update YukiTavern
git pull
# Install dependencies
npm install
# Compile the backend
npm run build
# Start the backend
npm run start
```

### Bun 🐇 (Linux only 🐧)

Might be faster than Node. Run Typescript directly with `bun src/server.ts`.

## Configuration

Edit the `config.json5` file in the root of the YukiTavern installation. Make sure it's valid [json5](https://json5.org/).
