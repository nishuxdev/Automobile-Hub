"""
Chatbot views for AutoMobile Hub.
Uses FAISS + SentenceTransformer for RAG with HuggingFace LLM.
Falls back to direct LLM if no PDF is loaded.
"""
import os
import json
import numpy as np
import logging

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.conf import settings

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# Global singletons – loaded once at first request
# ──────────────────────────────────────────────
_embedding_model = None
_faiss_index = None
_chunks = []
_llm = None
_initialized = False


def _initialize():
    """Lazy-load heavy ML models on first chat request."""
    global _embedding_model, _faiss_index, _chunks, _llm, _initialized

    if _initialized:
        return

    try:
        from sentence_transformers import SentenceTransformer
        from PyPDF2 import PdfReader
        import faiss
        from langchain_huggingface import ChatHuggingFace, HuggingFaceEndpoint

        # ── Load HuggingFace API key ──
        hf_key = os.getenv("HUGGINGFACE_API_KEY", "")
        if not hf_key:
            logger.warning("HUGGINGFACE_API_KEY not set – chatbot will return fallback responses.")
            _initialized = True
            return

        # ── Embedding model ──
        _embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        logger.info("Embedding model loaded.")

        # ── PDF loading ──
        pdf_path = os.getenv("CHATBOT_PDF_PATH", "")
        if pdf_path and os.path.exists(pdf_path):
            reader = PdfReader(pdf_path)
            text = ""
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"

            # ── Chunk ──
            chunk_size = 500
            _chunks = [text[i:i + chunk_size] for i in range(0, len(text), chunk_size)]
            logger.info(f"PDF loaded: {len(_chunks)} chunks.")

            # ── FAISS index ──
            embeddings = np.array(_embedding_model.encode(_chunks)).astype('float32')
            _faiss_index = faiss.IndexFlatL2(embeddings.shape[1])
            _faiss_index.add(embeddings)
            logger.info("FAISS index created.")
        else:
            logger.info("No PDF configured – chatbot will use LLM directly.")

        # ── LLM ──
        _llm = ChatHuggingFace(
            llm=HuggingFaceEndpoint(
                repo_id="Qwen/Qwen2.5-7B-Instruct",
                huggingfacehub_api_token=hf_key,
                temperature=0,
                max_new_tokens=512,
            )
        )
        logger.info("LLM loaded.")

    except ImportError as e:
        logger.error(f"Missing dependency for chatbot: {e}")
    except Exception as e:
        logger.error(f"Chatbot init error: {e}")

    _initialized = True


# ──────────────────────────────────────────────
# Automobile Hub knowledge base (fallback)
# ──────────────────────────────────────────────
AUTOMOBILE_HUB_CONTEXT = """
AutoMobile Hub is a premium motorcycle service platform that connects bike owners with verified, 
skilled mechanics. Key features include:

- **Instant Booking**: Book motorcycle repair and maintenance services in just a few taps.
- **Verified Mechanics**: Every mechanic is background-checked and skill-verified.
- **Live Tracking**: Track your mechanic's arrival and service progress in real-time.
- **Transparent Pricing**: No hidden charges. See the price breakdown before you confirm.
- **Service Categories**: General Service, Engine Repair, Brake Service, Electrical Work, 
  Tire & Wheel Service, Custom Modifications, Emergency Roadside Assistance.
- **For Mechanics**: Mechanics can register, manage their services, set availability, 
  track earnings, and grow their business through the platform.
- **Admin Panel**: Full platform management including user management, booking operations, 
  dispute resolution, payment tracking, and content management.
- **Rating System**: Customers can rate and review mechanics after service completion.
- **Learning Hub**: Educational lectures and resources for mechanics to upskill.

The platform uses a modern dark-themed UI with indigo/purple accent colors.
"""


@csrf_exempt
@require_POST
def chat_api(request):
    """Handle a chat message and return an AI response."""
    _initialize()

    try:
        body = json.loads(request.body)
        user_message = body.get("message", "").strip()

        if not user_message:
            return JsonResponse({"error": "Empty message"}, status=400)

        # ── Build context ──
        retrieved_text = ""
        if _faiss_index is not None and _embedding_model is not None:
            q_emb = np.array(_embedding_model.encode([user_message])).astype('float32')
            distances, indices = _faiss_index.search(q_emb, 2)
            retrieved_text = "\n".join([_chunks[i] for i in indices[0] if i < len(_chunks)])

        # Always include the built-in context
        context = AUTOMOBILE_HUB_CONTEXT
        if retrieved_text:
            context += "\n\nAdditional PDF Context:\n" + retrieved_text

        # ── Generate response ──
        if _llm is not None:
            from langchain_core.messages import HumanMessage

            prompt = f"""You are AutoBot, the friendly AI assistant for AutoMobile Hub — 
a premium motorcycle service platform.

Answer the user's question using the context below. Be helpful, concise, and friendly.
If the question is unrelated to automobiles or the platform, politely redirect.
Use emojis sparingly for friendliness.

Context:
{context}

User Question: {user_message}"""

            response = _llm.invoke([HumanMessage(content=prompt)])
            reply = response.content
        else:
            # Fallback when no LLM is available
            reply = _get_fallback_response(user_message)

        return JsonResponse({"reply": reply})

    except Exception as e:
        logger.error(f"Chat error: {e}")
        return JsonResponse({
            "reply": "I'm having a moment! 🔧 Please try again in a bit."
        })


def _get_fallback_response(message):
    """Simple keyword-based fallback when LLM is unavailable."""
    msg = message.lower()

    if any(w in msg for w in ["hello", "hi", "hey", "greet"]):
        return "Hey there! 👋 Welcome to AutoMobile Hub. I'm AutoBot, your virtual assistant. How can I help you today?"

    if any(w in msg for w in ["book", "service", "repair"]):
        return ("🔧 To book a service, sign in to your dashboard and click 'Book a Service'. "
                "You can choose from General Service, Engine Repair, Brake Service, and more!")

    if any(w in msg for w in ["mechanic", "register", "join"]):
        return ("🛠️ Want to join as a mechanic? Sign up and complete the onboarding process. "
                "You'll need to verify your skills and documents to start receiving jobs!")

    if any(w in msg for w in ["price", "cost", "charge", "fee"]):
        return ("💰 Our pricing is fully transparent! You'll see a complete breakdown before confirming. "
                "Prices vary by service type and your location.")

    if any(w in msg for w in ["track", "status", "where"]):
        return ("📍 You can track your service in real-time from your dashboard under 'My Bookings'. "
                "You'll see your mechanic's status and estimated arrival.")

    if any(w in msg for w in ["contact", "support", "help"]):
        return ("📞 Need help? You can reach us through the Contact section on our landing page, "
                "or email us at support@automobilehub.com. We're here for you!")

    return ("I'm AutoBot 🤖, your AutoMobile Hub assistant! I can help with booking services, "
            "finding mechanics, understanding pricing, and more. What would you like to know?")
