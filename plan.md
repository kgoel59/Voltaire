1. Get a raw a file
2. Split it into chunk max size 400
3. Summarize chunk using LLM
4. Use summary to get a topic from chuck using LLM
5. Use summary to get a question (Like asking LLM what question this chunk is answering )
6. Rename the file to question
7. Add link to orginal file 

#1 tagging
1. Get that topic embeddings
2. Compare that topic embeddings in a vector db to get 4 similar topics with cosine similarity of 90%
3. if topics found sort that and use first one and tag the file with that topic
4. else push new topic to vector db
5. create a folder with tag and put file there
6. once all chuck of a file are summarized get parent topic from llm and use same idea as before
7. Create parent folder and put all folders there

#2 idea sorting
1. Genarate embeddings for question
2. Compare that question embeddings in a vector db to get 1 similar question with cosine similarity of 90%
3. if question found merge that file of two questions (merge tags and backlinks connecting both)

#3 wiki link merging
1. Add link for wiki link merging