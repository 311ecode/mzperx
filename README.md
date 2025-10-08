# Looplijst PDF Parser 📰

Parse Dutch newspaper delivery route PDFs (Looplijst) into structured JSON format.

## 📁 Folder Structure

```
exporter/
├── parse_looplijst.py      # Main Python parser
├── setup_and_parse.sh      # Bash automation script
├── requirements.txt        # Python dependencies
└── README.md              # This file
```

## 🚀 Quick Start

### Option 1: Direct Execution (Recommended)

```bash
# Make script executable
chmod +x setup_and_parse.sh

# First time setup (creates conda env 'zordejrant')
./setup_and_parse.sh setup

# Parse a PDF file
./setup_and_parse.sh /path/to/your/looplijst.pdf
```

### Option 2: As Bash Function

```bash
# Source the script in your shell
source setup_and_parse.sh

# Now you can use the function anywhere
parse_looplijst /path/to/your/looplijst.pdf
```

Add to your `~/.bashrc` or `~/.zshrc` for permanent access:
```bash
source /full/path/to/exporter/setup_and_parse.sh
```

## 📦 What It Does

1. **Auto-Setup**: Creates conda environment `zordejrant` if it doesn't exist
2. **Dependency Management**: Installs `pdfplumber` automatically
3. **Smart Activation**: Activates the conda environment before parsing
4. **File Processing**: 
   - Reads PDF from any location (accepts full path)
   - Generates JSON in the **same folder** as the PDF
   - Naming: `looplijst.pdf` → `looplijst.json`

## 📄 Input/Output Example

**Input:** `/home/user/documents/looplijst_2025-10-09.pdf`

**Output:** `/home/user/documents/looplijst_2025-10-09.json`

## 🔧 Manual Installation

If you prefer manual setup:

```bash
# Create conda environment
conda create -n zordejrant python=3.10 -y

# Activate environment
conda activate zordejrant

# Install dependencies
pip install -r requirements.txt

# Run parser directly
python parse_looplijst.py /path/to/file.pdf
```

## 📊 JSON Output Structure

```json
{
  "metadata": {
    "distribution_date": "2025-10-09",
    "document_type": "Looplijst",
    "area": "HAARLEM NOORD",
    "route_code": "2OO2 O46 1OO242O7"
  },
  "newspaper_summary": [
    {
      "code": "HDC",
      "name": "Haarlems Dagblad",
      "total_circulation": 26
    }
  ],
  "complaints": [
    {
      "type": "NIET KRANT",
      "date": "2025-10-08",
      "product": "TEL",
      "address": "Vinkenstraat 55, HAARLEM",
      "name": "Cummins"
    }
  ],
  "delivery_route": [
    {
      "street": "VONDELWEG",
      "city": "HAARLEM",
      "deliveries": [
        {
          "house_number": "252",
          "newspaper": "HD",
          "name": "ZWAR"
        }
      ]
    }
  ]
}
```

## 🛠️ Requirements

- **Conda** (Miniconda or Anaconda)
- **Python 3.10+** (installed automatically via conda)
- **pdfplumber** (installed automatically)

## 🐛 Troubleshooting

### "Conda not found"
Install Miniconda: https://docs.conda.io/en/latest/miniconda.html

### "Permission denied"
Make script executable: `chmod +x setup_and_parse.sh`

### "Environment already exists"
The script will use the existing environment and just check dependencies

### Force reinstall dependencies
```bash
conda activate zordejrant
pip install --force-reinstall pdfplumber
```

## 📝 Usage Examples

```bash
# Parse single file
parse_looplijst ~/Downloads/looplijst.pdf

# Parse with full path
parse_looplijst /home/user/documents/deliveries/route_2025-10-09.pdf

# Parse multiple files (loop)
for pdf in ~/routes/*.pdf; do
    parse_looplijst "$pdf"
done
```

## 🎯 Features

- ✅ Automatic environment management
- ✅ Dependency installation
- ✅ Full path support
- ✅ JSON output in same folder as PDF
- ✅ Colored terminal output
- ✅ Error handling
- ✅ Conda environment: `zordejrant`

## 📜 License

Free to use for newspaper delivery route management.

---

**Made with ❤️ for efficient krantenbezorging**
