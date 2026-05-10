# TAR System Types & Schema

This document outlines the standard types and database schemas for the **5 Tables of Physics** architecture, as defined in `schema-visual.html`.

## 1. MATTER
The fundamental substance and global catalog. Defines the intrinsic nature of an entity.
* `id` **TEXT** (PK)
* `code` **TEXT** (UNIQUE)
* `type` **TEXT**
* `scope` **TEXT**
* `owner` **TEXT**
* `title` **TEXT**
* `public` **INTEGER**
* `data` **TEXT (JSON)**
* `time` **TIMESTAMPTZ**

## 2. MASS
Physical realization. Defines quantity, price, and exact spatial location.
* `id` **TEXT** (PK)
* `matter` **TEXT** (FK -> matter.id)
* `type` **TEXT**
* `scope` **TEXT**
* `qty` **REAL**
* `value` **REAL**
* `active` **INTEGER**
* `geo` **TEXT (H3)**
* `start` **TIMESTAMPTZ**
* `end` **TIMESTAMPTZ**
* `data` **TEXT (JSON)**
* `time` **TIMESTAMPTZ**

## 3. MOTION
Kinetic ledger. Append-only chronological record of all matter transitions and actions.
* `id` **TEXT** (PK)
* `stream` **TEXT**
* `seq` **INTEGER**
* `action` **INTEGER** (Mapped to event opcodes)
* `status` **TEXT**
* `delta` **REAL**
* `scope` **TEXT**
* `data` **TEXT (JSON)**
* `time` **TIMESTAMPTZ**

## 4. RELATION
The structural network. Defines the scientific and logical links between Matter.
* `src` **TEXT** (PK)
* `tgt` **TEXT** (PK)
* `type` **TEXT** (PK)
* `weight` **REAL**
* `time` **TIMESTAMPTZ**

## 5. MEMORY
Semantic memory. High-dimensional vector space for AI reasoning and embeddings.
* `matter` **TEXT** (PK, FK -> matter.id)
* `vector` **F32_BLOB(384)**
