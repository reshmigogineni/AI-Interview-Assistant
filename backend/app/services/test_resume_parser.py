from app.services.resume_parser import extract_resume_text


file_path = "sample_resume.pdf"

text = extract_resume_text(file_path)

print("Resume text extracted successfully!")
print("-----------------------------------")
print(text)