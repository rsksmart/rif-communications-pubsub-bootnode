export default interface CommunicationsApi {
    connectToCommunicationsNode: (call: any) => Promise<void>;
    endCommunication: (parameters: any, callback: any) => void;
    subscribe: (parameters: any, callback: any) => void;
    unsubscribe: (parameters: any, callback: any) => void;
    publish: (parameters: any, callback: any) => Promise<void>;
    getSubscribers: (parameters: any, callback: any) => void;
    hasSubscriber: (parameters: any, callback: any) => void;
    IsSubscribedToRskAddress: ({request: subscriber}: any, callback: any) => Promise<void>;
    sendMessage: (parameters: any, callback: any) => Promise<void>;
    locatePeerId: (parameters: any, callback: any) => Promise<void>;
    createTopicWithPeerId: (call: any) => Promise<void>;
    createTopicWithRskAddress: (call: any) => Promise<void>;
    closeTopicWithRskAddress: ({request: subscriber}: any, callback: any) => Promise<void>;
    sendMessageToTopic: (parameters: any, callback: any) => Promise<void>;
    sendMessageToRskAddress: ({request}: any, callback: any) => Promise<void>;
    updateAddress: (parameters: any, callback: any) => Promise<void>;
}