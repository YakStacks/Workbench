"use strict";
/**
 * Core Event Bus - Runtime observability layer
 *
 * Phase 1: Minimal typed events for core runtime operations
 * No dependencies. No heavy framework. Just event emission.
 *
 * Consumers optional - events emitted whether subscribed or not.
 * Future: Sessions, audit logs, monitoring can subscribe.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventBus = exports.EventBus = void 0;
exports.createTimestamp = createTimestamp;
/**
 * Minimal event bus - pub/sub for runtime events
 *
 * Phase 1: Simple in-memory event bus
 * - Type-safe event emission
 * - Subscription management
 * - No persistence (events are ephemeral)
 * - No queuing (fire and forget)
 */
var EventBus = /** @class */ (function () {
    function EventBus() {
        this.handlers = new Map();
        this.allHandlers = [];
    }
    /**
     * Emit an event to all subscribers
     *
     * Phase 1: Fire and forget - no error handling for handlers
     * Handlers should not throw (best effort)
     */
    EventBus.prototype.emit = function (event) {
        // Emit to type-specific handlers
        var typeHandlers = this.handlers.get(event.type) || [];
        for (var _i = 0, typeHandlers_1 = typeHandlers; _i < typeHandlers_1.length; _i++) {
            var handler = typeHandlers_1[_i];
            try {
                handler(event);
            }
            catch (error) {
                // Silent failure - event handlers should not break core flow
                console.error("[EventBus] Handler error for ".concat(event.type, ":"), error);
            }
        }
        // Emit to wildcard handlers (subscribed to all events)
        for (var _a = 0, _b = this.allHandlers; _a < _b.length; _a++) {
            var handler = _b[_a];
            try {
                handler(event);
            }
            catch (error) {
                console.error("[EventBus] Wildcard handler error:", error);
            }
        }
    };
    /**
     * Subscribe to specific event type
     * Returns unsubscribe function
     */
    EventBus.prototype.on = function (type, handler) {
        var _this = this;
        var handlers = this.handlers.get(type) || [];
        handlers.push(handler);
        this.handlers.set(type, handlers);
        // Return unsubscribe function
        return function () {
            var current = _this.handlers.get(type) || [];
            var index = current.indexOf(handler);
            if (index > -1) {
                current.splice(index, 1);
            }
        };
    };
    /**
     * Subscribe to all events (wildcard)
     * Returns unsubscribe function
     */
    EventBus.prototype.onAll = function (handler) {
        var _this = this;
        this.allHandlers.push(handler);
        // Return unsubscribe function
        return function () {
            var index = _this.allHandlers.indexOf(handler);
            if (index > -1) {
                _this.allHandlers.splice(index, 1);
            }
        };
    };
    /**
     * Remove all handlers for a specific type
     */
    EventBus.prototype.off = function (type) {
        this.handlers.delete(type);
    };
    /**
     * Remove all handlers (reset)
     */
    EventBus.prototype.clear = function () {
        this.handlers.clear();
        this.allHandlers = [];
    };
    /**
     * Get subscriber count (for debugging)
     */
    EventBus.prototype.getSubscriberCount = function (type) {
        if (type) {
            return (this.handlers.get(type) || []).length;
        }
        // Total subscribers across all types + wildcard
        var total = this.allHandlers.length;
        var handlerArrays = Array.from(this.handlers.values());
        for (var i = 0; i < handlerArrays.length; i++) {
            total += handlerArrays[i].length;
        }
        return total;
    };
    return EventBus;
}());
exports.EventBus = EventBus;
// ============================================================================
// SINGLETON INSTANCE
// ============================================================================
/**
 * Global event bus instance
 *
 * Phase 1: Single shared bus
 * Future: Could support multiple buses for isolation
 */
exports.eventBus = new EventBus();
// ============================================================================
// HELPER: Event creation
// ============================================================================
/**
 * Create timestamp for events (milliseconds since epoch)
 */
function createTimestamp() {
    return Date.now();
}
