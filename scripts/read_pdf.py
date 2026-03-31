from pdfminer.high_level import extract_text
text = extract_text('Documentation/PRD TFW.pdf')
print(text[5000:15000])
